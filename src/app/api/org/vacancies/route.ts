import { ensureDbInitialized } from "@/lib/db";
import { getVacancies, createVacancy, getPlatformUserOrgId } from "@/lib/neon-storage";
import { getClerkUserId, sanitizeText } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * List vacancies for the caller's organization.
 */
export async function GET() {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });
  const vacancies = await getVacancies(orgId);
  return Response.json(vacancies);
}

const createVacancySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(10).max(5000),
  category: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  employmentType: z.string().max(50).optional(),
  salaryRange: z.string().max(100).optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  applicationDeadline: z.string().optional(),
});

/**
 * Create a vacancy for the caller's organization.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });

  const body = await request.json();
  const parsed = createVacancySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Validation error", errors: parsed.error.issues }, { status: 400 });
  }

  const vacancy = await createVacancy({
    organizationId: orgId,
    title: sanitizeText(parsed.data.title),
    description: sanitizeText(parsed.data.description),
    category: parsed.data.category,
    location: parsed.data.location,
    employmentType: parsed.data.employmentType,
    salaryRange: parsed.data.salaryRange,
    requirements: parsed.data.requirements,
    responsibilities: parsed.data.responsibilities,
    applicationDeadline: parsed.data.applicationDeadline,
    postedByClerkId: clerkUserId,
  });
  return Response.json(vacancy, { status: 201 });
}
