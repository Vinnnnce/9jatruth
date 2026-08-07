import { ensureDbInitialized } from "@/lib/db";
import { getVapidPublicKey, isPushConfigured } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  return Response.json({
    publicKey: getVapidPublicKey(),
    configured: isPushConfigured(),
  });
}
