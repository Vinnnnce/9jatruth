import { ensureDbInitialized } from "@/lib/db";
import { registerSubscription } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  categories: z.array(z.string()).optional(),
  neighborhoods: z.array(z.number()).optional(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const body = await request.json();
  const parsed = validate(subscribeSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const deviceHash = await getUserId(request);
  const sub = await registerSubscription({
    deviceHash,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    categories: parsed.data.categories,
    neighborhoods: parsed.data.neighborhoods,
  });
  return Response.json({ success: true, id: sub.id }, { status: 201 });
}
