import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/rewards/categories — list all reward categories
 */
export async function GET() {
  await ensureDbInitialized();
  const sql = getDb();

  const rows = (await sql`
    SELECT id, name, description, icon, active, created_at
    FROM reward_categories
    WHERE active = TRUE
    ORDER BY id ASC
  `) as unknown as any[];

  return Response.json({
    categories: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
      active: r.active,
      createdAt: r.created_at,
    })),
  });
}
