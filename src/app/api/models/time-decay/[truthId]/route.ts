import { ensureDbInitialized } from "@/lib/db";
import { getTruth, getVerifications, runTimeDecayModel } from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const idParamSchema = z.object({
  truthId: z.coerce.number().int().positive().max(1_000_000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ truthId: string }> }
) {
  await ensureDbInitialized();
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  const { truthId } = await params;
  const parsed = validate(idParamSchema, { truthId });
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const truth = await getTruth(parsed.data.truthId);
  if (!truth) return Response.json({ message: "Truth not found" }, { status: 404 });
  const verifications = await getVerifications(parsed.data.truthId);
  const result = runTimeDecayModel({ truth, verifications });
  return Response.json(result);
}
