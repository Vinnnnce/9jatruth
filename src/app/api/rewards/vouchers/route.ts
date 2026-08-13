import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { generateVoucherCode } from "@/lib/telecom";
import { z } from "zod";

const createVoucherSchema = z.object({
  storeName: z.string().min(1).max(200),
  storeType: z.string().max(50).default("general"),
  description: z.string().max(500).optional(),
  discountType: z.enum(["fixed", "percentage"]).default("fixed"),
  discountValue: z.number().int().positive().max(100000),
  minPurchase: z.number().int().min(0).max(100000).default(0),
  maxDiscount: z.number().int().positive().max(100000).optional(),
  validDays: z.number().int().positive().max(3650).default(30),
  partnerBusiness: z.string().max(200).optional(),
  quantity: z.number().int().positive().max(100).default(1),
});

/**
 * GET /api/rewards/vouchers — list available vouchers
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const storeName = searchParams.get("storeName");

  const rows = storeName
    ? ((await sql`
        SELECT * FROM store_vouchers
        WHERE status = 'active' AND store_name ILIKE ${"%" + storeName + "%"}
        ORDER BY created_at DESC
        LIMIT 100
      `) as unknown as any[])
    : ((await sql`
        SELECT * FROM store_vouchers
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT 100
      `) as unknown as any[]);

  return Response.json({
    vouchers: rows.map((r) => ({
      id: r.id,
      code: r.code,
      storeName: r.store_name,
      storeType: r.store_type,
      description: r.description,
      discountType: r.discount_type,
      discountValue: r.discount_value,
      minPurchase: r.min_purchase,
      maxDiscount: r.max_discount,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      status: r.status,
      partnerBusiness: r.partner_business,
      createdAt: r.created_at,
    })),
  });
}

/**
 * POST /api/rewards/vouchers — admin create voucher
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

  const parsed = validate(createVoucherSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const sql = getDb();
  const validFrom = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + data.validDays);

  const created: any[] = [];
  for (let i = 0; i < data.quantity; i++) {
    const code = generateVoucherCode(data.storeName);
    const rows = (await sql`
      INSERT INTO store_vouchers (
        code, store_name, store_type, description, discount_type, discount_value,
        min_purchase, max_discount, valid_from, valid_until, status, partner_business
      ) VALUES (
        ${code}, ${data.storeName}, ${data.storeType}, ${data.description || null},
        ${data.discountType}, ${data.discountValue}, ${data.minPurchase},
        ${data.maxDiscount || null}, ${validFrom}, ${validUntil}, 'active',
        ${data.partnerBusiness || null}
      )
      RETURNING *
    `) as unknown as any[];
    created.push(rows[0]);
  }

  // Audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, description, new_values)
      VALUES (${clerkUserId}, 'admin', 'super_admin', 'create_vouchers',
              'store_voucher', ${'Created ' + data.quantity + ' ' + data.storeName + ' vouchers'},
              ${JSON.stringify({ storeName: data.storeName, discountValue: data.discountValue, quantity: data.quantity })})
    `;
  } catch (err) {
    console.error("[vouchers/POST] Audit log error:", err);
  }

  return Response.json(
    {
      vouchers: created.map((r) => ({
        id: r.id,
        code: r.code,
        storeName: r.store_name,
        storeType: r.store_type,
        discountType: r.discount_type,
        discountValue: r.discount_value,
        validFrom: r.valid_from,
        validUntil: r.valid_until,
        status: r.status,
      })),
      count: created.length,
    },
    { status: 201 }
  );
}
