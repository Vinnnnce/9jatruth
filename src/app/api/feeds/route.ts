import { ensureDbInitialized } from "@/lib/db";
import {
  listFeeds,
  createFeed,
  type CreateFeedRecord,
} from "@/lib/community-feed-storage";
import {
  tagFeedContent,
  detectFeedSpam,
  classifyCommunity,
} from "@/lib/community-feed-ai";
import { assignLocationFromCoordinates, resolveOrCreateWard } from "@/lib/geo-reverse";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getClerkUserId,
  getIpLocation,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import {
  createFeedSchema,
  listFeedsQuerySchema,
  type CreateFeedInput,
} from "@shared/schema";

export const dynamic = "force-dynamic";

// ─── GET /api/feeds ─────────────────────────────────────────────────────────
// Unified, scope-based feed retrieval. Powers the feeds-page tabs:
//   ?scope=near|community|ward|lga|state|all
// Manual dropdown filters (state/lga/ward/community) refine/override the tab.
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(listFeedsQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  // For "near" scope, fall back to the viewer's IP-derived location if no
  // browser coordinates were supplied.
  let q = parsed.data;
  if (q.scope === "near" && (q.lat == null || q.lng == null)) {
    const ipLoc = await getIpLocation(request).catch(() => null);
    if (ipLoc?.ipLat != null && ipLoc?.ipLng != null) {
      q = { ...q, lat: ipLoc.ipLat, lng: ipLoc.ipLng };
    } else {
      // No location available — gracefully widen to "all".
      q = { ...q, scope: "all" as const };
    }
  }

  const viewerHash = await getUserId(request).catch(() => null);
  const result = await listFeeds(q, viewerHash);
  return Response.json(result);
}

// ─── POST /api/feeds ────────────────────────────────────────────────────────
// Create a community feed. Auto-detects location (browser lat/lng or IP),
// reverse-geocodes to state → LGA → ward → community, runs the AI pipeline
// (tagging + spam detection + community classification), and persists with geo IDs.
export async function POST(request: Request) {
  await ensureDbInitialized();

  // Auth: require Clerk sign-in when configured (mirrors /api/truths).
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured =
      !!clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json(
        { message: "Unauthorized — Please sign in to post" },
        { status: 401 }
      );
    }
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: CreateFeedInput;
  try {
    const raw = await request.json();
    const parsed = validate(createFeedSchema, raw);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    body = parsed.data;
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const content = sanitizeText(body.content);
  if (!content || content.length < 3) {
    return Response.json({ message: "Content too short" }, { status: 400 });
  }

  const userHash = await getUserId(request);

  // ── Step 1: Location assignment ──────────────────────────────────────────
  let lat = body.lat ?? null;
  let lng = body.lng ?? null;
  let locationSource = body.locationSource || "manual";

  if (lat == null || lng == null) {
    const ipLoc = await getIpLocation(request).catch(() => null);
    if (ipLoc?.ipLat != null && ipLoc?.ipLng != null) {
      lat = ipLoc.ipLat;
      lng = ipLoc.ipLng;
      locationSource = "ip";
    }
  } else {
    locationSource = body.locationSource || "browser";
  }

  const assignment = await assignLocationFromCoordinates({
    lat,
    lng,
    source: locationSource,
    stateName: body.stateName,
    lgaName: body.lgaName,
    wardName: body.wardName,
    communityName: body.communityName,
  });

  // If location is still missing/weak, run the AI community classifier.
  let aiPrediction: unknown = null;
  let relevanceScore = 50;
  if (!assignment.stateName && !assignment.lgaName) {
    const classification = await classifyCommunity(content, {
      stateName: body.stateName,
      lgaName: body.lgaName,
    });
    aiPrediction = classification;
    relevanceScore = classification.relevanceScore;
    if (classification.stateName && !assignment.stateName) {
      assignment.stateName = classification.stateName;
    }
    if (classification.lgaName && !assignment.lgaName) {
      assignment.lgaName = classification.lgaName;
    }
  }

  // Resolve or create the ward row if a ward name was supplied but not found.
  if (assignment.wardName && assignment.lgaId && !assignment.wardId) {
    assignment.wardId = await resolveOrCreateWard(
      assignment.lgaId,
      assignment.stateId,
      assignment.wardName,
      assignment.lat,
      assignment.lng
    );
  }

  // ── Step 2: AI tagging + spam detection ───────────────────────────────────
  const [tagResult, spamResult] = await Promise.all([
    tagFeedContent(content),
    detectFeedSpam(content, userHash, assignment),
  ]);

  if (spamResult.verdict === "blocked") {
    return Response.json(
      {
        message: "Post blocked by automated moderation",
        reasons: spamResult.reasons,
        spamScore: spamResult.spamScore,
      },
      { status: 422 }
    );
  }

  // ── Step 3: Persist ───────────────────────────────────────────────────────
  const record: CreateFeedRecord = {
    userHash,
    clerkUserId,
    content,
    category: body.category || tagResult.category,
    tags: tagResult.tags,
    mediaUrls: body.mediaUrls || [],
    stateId: assignment.stateId,
    lgaId: assignment.lgaId,
    wardId: assignment.wardId,
    communityId: assignment.communityId,
    stateName: assignment.stateName,
    lgaName: assignment.lgaName,
    wardName: assignment.wardName,
    communityName: assignment.communityName,
    regionName: assignment.regionName,
    lat: assignment.lat,
    lng: assignment.lng,
    locationSource: assignment.source,
    assignmentConfidence: assignment.assignmentConfidence,
    aiCommunityPrediction: aiPrediction,
    aiRelevanceScore: relevanceScore,
    spamScore: spamResult.spamScore,
    spamVerdict: spamResult.verdict,
    trustScore: 50,
    status: spamResult.verdict === "suspicious" ? "flagged" : "published",
  };

  const feed = await createFeed(record);
  return Response.json(
    {
      feed,
      ai: {
        tags: tagResult.tags,
        tagSource: tagResult.source,
        spam: spamResult,
        assignment: {
          stateName: assignment.stateName,
          lgaName: assignment.lgaName,
          wardName: assignment.wardName,
          communityName: assignment.communityName,
          confidence: assignment.assignmentConfidence,
          source: assignment.source,
        },
      },
    },
    { status: 201 }
  );
}
