# Backend API Routes — Build Summary

All backend API routes for the 9jatruth platform have been built and verified. TypeScript compiles with **zero errors**.

## Files Created (36 route files)

### 1. News API Routes (`src/app/api/news/`)
- `route.ts` — GET (list published articles with filters: category, state, lga, tag, search) / POST (create article with auth, Zod validation, auto-slug, author lookup from platform_users)
- `[id]/route.ts` — GET (single article, increments view_count) / PUT (update article, dynamic field updates) / DELETE (delete article)
- `[id]/comments/route.ts` — GET (list comments with like counts, paginated) / POST (create comment with rich content: content, imageUrl, stickerId, giftId, parentCommentId; resolves author name/avatar from Clerk)
- `[id]/like/route.ts` — POST (toggle like on article, updates like_count)
- `[id]/comments/[commentId]/like/route.ts` — POST (toggle like on comment, uses comment_likes table)
- `create/route.ts` — POST (create article with media upload support — accepts JSON or multipart/form-data with file uploads, validates image/video types and sizes)
- `verify/route.ts` — POST (admin verify article, awards accuracy incentives to reward_ledger + device_profiles, creates audit log)
- `feed/route.ts` — GET (news feed for feeds page — returns published articles with verification badges, sorted by verified first)

### 2. Rewards API Routes (`src/app/api/rewards/`)
- `categories/route.ts` — GET (list all active reward categories)
- `redeem/route.ts` — POST (supports airtime, data, giftcard, voucher, cash; validates type-specific fields; checks balance; deducts from device_profiles; creates ledger entry + redemption record)
- `redemptions/route.ts` — GET (list user's redemption history with pagination and status filter)
- `redemptions/[id]/route.ts` — GET (single redemption detail; users see own, admin sees any) / PUT (admin approve/deny/fulfill; refunds on deny; creates audit log)
- `gift-cards/route.ts` — GET (list available gift cards) / POST (admin generate gift cards using generateGiftCardCode)
- `gift-cards/[id]/route.ts` — GET (gift card detail) / PUT (redeem gift card; row-level locking; credits reward balance)
- `vouchers/route.ts` — GET (list available vouchers) / POST (admin create vouchers using generateVoucherCode)
- `vouchers/[id]/route.ts` — GET (voucher detail) / PUT (redeem voucher; calculates fixed/percentage discount; row-level locking)

### 3. Telecom API Routes (`src/app/api/telecom/`)
- `purchase/route.ts` — POST (purchase airtime/data using purchaseAirtimeOrData; validates phone number with validatePhoneNumber; auto-detects network with detectNetwork; creates telecom_transactions record; updates linked redemption)
- `transactions/route.ts` — GET (list user's telecom transactions with pagination and status filter)
- `transactions/[id]/route.ts` — GET (single transaction detail)
- `data-plans/route.ts` — GET (list available data plans per network using DATA_PLANS)
- `verify/route.ts` — POST (verify transaction status using verifyTransaction; updates transaction status)

### 4. Comments API Routes (`src/app/api/comments/`)
- `[commentId]/like/route.ts` — POST (toggle like on a comment, returns new like count; uses comment_likes table)
- `[commentId]/replies/route.ts` — GET (list replies to a comment via parent_comment_id; paginated)

### 5. Questionnaire API Routes (`src/app/api/questionnaire/`)
- `manage/route.ts` — GET (list all questionnaires, admin only) / POST (admin create questionnaire with questions array; full question schema validation)
- `manage/[id]/route.ts` — GET / PUT (dynamic field updates) / DELETE (all admin only; audit logging)

### 6. Feedback API Routes (`src/app/api/feedback/`)
- `schedule/route.ts` — GET (check if feedback prompt should show — 3-day initial delay, 30-day interval, max 12 prompts) / POST (record feedback submission, auto-creates/updates schedule)
- `schedule/check/route.ts` — GET (check feedback schedule status for current user)

### 7. Audit Log API Routes (`src/app/api/audit/`)
- `logs/route.ts` — GET (list audit logs with filters: entityType, actorId, action, dateRange; admin only)
- `logs/[id]/route.ts` — GET (single audit log detail; admin only)

### 8. Admin API Routes (`src/app/api/admin/`)
- `rewards/route.ts` — GET (list all reward redemptions for admin dashboard with summary stats)
- `rewards/[id]/route.ts` — PUT (approve/deny/fulfill redemption with audit log; refunds on deny)
- `news/route.ts` — GET (list all news articles for admin with filters)
- `news/[id]/route.ts` — PUT (verify/reject/archive/publish/unpublish article with incentive logic; awards accuracy bonus to reward_ledger)
- `telecom/route.ts` — GET (list all telecom transactions with summary stats)
- `audit/route.ts` — GET (list audit logs with filters)

### 9. Media Upload API Route (`src/app/api/media/`)
- `upload/route.ts` — POST (handle image and video upload; max 60s video/60MB; images 10MB; writes to public/uploads with date-based directory structure; returns public URL)

## Patterns Followed (consistent with existing codebase)

Every route follows the established patterns:
- **`await ensureDbInitialized()`** called first in every handler
- **`const sql = getDb()`** for raw SQL queries via Neon tagged template
- Imports from `@/lib/db`, `@/lib/api-helpers`, `@/lib/security`
- **Zod validation** for all request bodies and query params (using `validate()` / `validationErrorResponse()`)
- **`getClerkUserId()`** for auth checks (returns 401 if not authenticated)
- **`getUserId()`** for user hash (privacy-preserving SHA-256 of Clerk ID)
- **`csrfCheck(request)`** on all mutating routes (POST/PUT/DELETE)
- **`isSuperAdmin()`** from `@/lib/admin-auth` for all admin-only routes (returns 403)
- **`Response.json()`** for all responses with proper status codes
- **`sanitizeText()`** for user-provided text content
- **Audit logging** in admin routes that modify state (rewards, news, questionnaires, gift cards, vouchers)
- **Telecom library** (`@/lib/telecom.ts`) used for all telecom operations: `purchaseAirtimeOrData`, `verifyTransaction`, `DATA_PLANS`, `detectNetwork`, `validatePhoneNumber`, `generateGiftCardCode`, `generateVoucherCode`

## Verification

- TypeScript: `tsc --noEmit` passes with **zero errors** (using project's TypeScript 5.6.3)
- All 36 files present and non-empty
