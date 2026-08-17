import { ensureDbInitialized } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const TMP_DIR = "/tmp/9jatruth-uploads";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 60 * 1024 * 1024; // 60MB (max 60s video)
const MAX_VIDEO_DURATION_SECONDS = 60;
// On Vercel serverless, the filesystem is read-only except /tmp.
// For files under this size, return data URLs (base64) which work everywhere.
// For larger files, try /tmp (ephemeral but works within a request lifecycle).
const DATA_URL_THRESHOLD = 15 * 1024 * 1024; // 15MB — use data URL for files under this

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

/**
 * Check if we're running on Vercel (serverless, read-only filesystem).
 */
function isServerless(): boolean {
  return !!process.env.VERCEL || !!process.env.VERCEL_ENV;
}

/**
 * POST /api/media/upload — handle image and video upload
 * Max 60s video. Returns the URL.
 *
 * Accepts multipart/form-data with a "file" field.
 *
 * On Vercel: returns data URLs (base64) for portable storage.
 * In development: writes to public/uploads/ and returns the URL path.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to upload media" }, { status: 401 });
    }
  }

  const userHash = await getUserId(request);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ message: "Content-Type must be multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ message: "No file provided. Use 'file' field." }, { status: 400 });
  }

  // Validate file type
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return Response.json(
      { message: `File type ${file.type} not supported. Allowed: ${[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  // Validate file size
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return Response.json(
      { message: `File exceeds maximum size of ${maxMB}MB` },
      { status: 400 }
    );
  }

  // Validate video duration if provided
  const durationStr = formData.get("duration");
  if (isVideo && durationStr) {
    const duration = parseFloat(String(durationStr));
    if (!isNaN(duration) && duration > MAX_VIDEO_DURATION_SECONDS) {
      return Response.json(
        { message: `Video duration exceeds maximum of ${MAX_VIDEO_DURATION_SECONDS} seconds` },
        { status: 400 }
      );
    }
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Strategy: On serverless (Vercel), use data URLs for portability.
  // In development, try filesystem first, fall back to data URL.
  const useDataUrl = isServerless() || file.size <= DATA_URL_THRESHOLD;

  if (useDataUrl) {
    // Return a data URL (base64) — works everywhere, stored inline in DB
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return Response.json(
      {
        success: true,
        url: dataUrl,
        fileType: isImage ? "image" : "video",
        mimeType: file.type,
        size: file.size,
        originalName: file.name,
        storage: "data-url",
      },
      { status: 201 }
    );
  }

  // For larger files (videos > 15MB), try filesystem in dev or /tmp on Vercel
  const ext = path.extname(file.name) || (isImage ? ".jpg" : ".mp4");
  const hash = crypto.createHash("sha256").update(userHash + Date.now()).digest("hex").slice(0, 16);
  const dateDir = new Date().toISOString().slice(0, 10);
  const filename = `${hash}${ext}`;

  // Try /tmp first (works on Vercel), then public/uploads (dev)
  const tmpPath = path.join(TMP_DIR, dateDir, filename);
  const publicPath = path.join(UPLOAD_DIR, dateDir, filename);

  let savedPath: string | null = null;
  let savedUrl: string | null = null;

  // Try /tmp (works on Vercel serverless)
  try {
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await fs.writeFile(tmpPath, buffer);
    savedPath = tmpPath;
    // /tmp files are ephemeral — return as data URL for persistence
    const base64 = buffer.toString("base64");
    savedUrl = `data:${file.type};base64,${base64}`;
  } catch {
    // Try public/uploads (development only)
    try {
      await fs.mkdir(path.dirname(publicPath), { recursive: true });
      await fs.writeFile(publicPath, buffer);
      savedPath = publicPath;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const urlPath = `/uploads/${dateDir}/${filename}`;
      savedUrl = baseUrl ? `${baseUrl}${urlPath}` : urlPath;
    } catch (err) {
      console.error("[media/upload] Failed to write file:", err);
      // Last resort: return data URL
      const base64 = buffer.toString("base64");
      savedUrl = `data:${file.type};base64,${base64}`;
    }
  }

  return Response.json(
    {
      success: true,
      url: savedUrl,
      fileType: isImage ? "image" : "video",
      mimeType: file.type,
      size: file.size,
      originalName: file.name,
      storage: savedPath === publicPath ? "filesystem" : "data-url",
    },
    { status: 201 }
  );
}
