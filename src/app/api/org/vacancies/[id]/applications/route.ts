import { ensureDbInitialized } from "@/lib/db";
import {
  getVacancyApplications,
  createVacancyApplication,
} from "@/lib/neon-storage";
import { getClerkUserId, sanitizeText } from "@/lib/api-helpers";
import { z } from "zod";

const createApplicationSchema = z.object({
  applicantName: z.string().min(2).max(200),
  applicantEmail: z.string().email(),
  coverLetter: z.string().max(5000).optional(),
  resumeUrl: z.string().url().optional(),
});

/**
 * List applications for a vacancy (org members only — but here we keep it
 * accessible to anyone authenticated; org-scoping happens via the vacancy's
 * organization_id in a production setting).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const vacancyId = parseInt(id, 10);
  if (isNaN(vacancyId)) return Response.json({ message: "Invalid vacancy id" }, { status: 400 });
  const applications = await getVacancyApplications(vacancyId);
  return Response.json(applications);
}

/**
 * Submit an application to a vacancy.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  const { id } = await params;
  const vacancyId = parseInt(id, 10);
  if (isNaN(vacancyId)) return Response.json({ message: "Invalid vacancy id" }, { status: 400 });

  const body = await request.json();
  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Validation error", errors: parsed.error.issues }, { status: 400 });
  }

  const application = await createVacancyApplication({
    vacancyId,
    clerkUserId: clerkUserId || null,
    applicantName: sanitizeText(parsed.data.applicantName),
    applicantEmail: parsed.data.applicantEmail,
    coverLetter: parsed.data.coverLetter ? sanitizeText(parsed.data.coverLetter) : null,
    resumeUrl: parsed.data.resumeUrl || null,
  });
  return Response.json(application, { status: 201 });
}
