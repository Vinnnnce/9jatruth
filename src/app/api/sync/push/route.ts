import { ensureDbInitialized } from "@/lib/db";
import { handleSyncPush } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";
import { csrfCheck } from "@/lib/security";

const syncPushSchema = z.object({
  deviceHash: z.string().optional(),
  bundle: z
    .array(
      z.object({
        operation: z.enum(["truth_create", "verify", "redeem"]),
        payload: z.record(z.string(), z.any()),
        clientTimestamp: z.string(),
        clientId: z.string(),
      })
    )
    .min(1)
    .max(100),
  lastSyncAt: z.string().optional(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const body = await request.json();
  const parsed = validate(syncPushSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const deviceHash = parsed.data.deviceHash || (await getUserId(request));
  const result = await handleSyncPush({
    deviceHash,
    bundle: parsed.data.bundle,
    lastSyncAt: parsed.data.lastSyncAt,
  });
  return Response.json(result);
}
