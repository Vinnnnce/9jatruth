import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { generateGiftCardCode } from "@/lib/telecom";
import { z } from "zod";

const generateSchema = z.object({
  type: z.string().min(1).max(50),
  brand: z.string().min(1).max(100),
  faceValue: z.number().int().positive().max(100000),
  currency: z.string().max(10).default("NGN"),
  expiryDays: z.number().int().positive().max(3650).default(365),
  quantity: z.number().int().positive().max(100).default(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/rewards/gift-cards — list available gift cards
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const includeRedeemed = searchParams.get("includeRedeemed") === "true";

  const rows = includeRedeemed
    ? ((await sql`
        SELECT * FROM gift_cards
        ${type ? sql`WHERE type = ${type}` : sql``}
        ORDER BY created_at DESC
        LIMIT 100
      `) as unknown as any[])
    : ((await sql`
        SELECT * FROM gift_cards
        WHERE status = 'active' ${type ? sql`AND type = ${type}` : sql``}
        ORDER BY created_at DESC
        LIMIT 100
      `) as unknown as any[]);

  return Response.json({
    giftCards: rows.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      brand: r.brand,
      faceValue: r.face_value,
      balance: r.balance,
      currency: r.currency,
      expiryDate: r.expiry_date,
      status: r.status,
      redeemedBy: r.redeemed_by,
      redeemedAt: r.redeemed_at,
      createdAt: r.created_at,
    })),
  });
}

/**
 * POST /api/rewards/gift-cards — admin generate gift cards
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(generateSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const sql = getDb();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + data.expiryDays);

  const created: any[] = [];
  for (let i = 0; i < data.quantity; i++) {
    const code = generateGiftCardCode(data.brand);
    const rows = (await sql`
      INSERT INTO gift_cards (code, type, brand, face_value, balance, currency, expiry_date, status, created_by, metadata)
      VALUES (${code}, ${data.type}, ${data.brand}, ${data.faceValue}, ${data.faceValue}, ${data.currency},
              ${expiryDate}, 'active', ${clerkUserId}, ${JSON.stringify(data.metadata || {})})
      RETURNING *
    `) as unknown as any[];
    created.push(rows[0]);
  }

  // Audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, description, new_values)
      VALUES (${clerkUserId}, 'admin', 'super_admin', 'generate_gift_cards',
              'gift_card', ${'Generated ' + data.quantity + ' ' + data.brand + ' gift cards'},
              ${JSON.stringify({ type: data.type, brand: data.brand, faceValue: data.faceValue, quantity: data.quantity })})
    `;
  } catch (err) {
    console.error("[gift-cards/POST] Audit log error:", err);
  }

  return Response.json(
    {
      giftCards: created.map((r) => ({
        id: r.id,
        code: r.code,
        type: r.type,
        brand: r.brand,
        faceValue: r.face_value,
        balance: r.balance,
        currency: r.currency,
        expiryDate: r.expiry_date,
        status: r.status,
      })),
      count: created.length,
    },
    { status: 201 }
  );
}
