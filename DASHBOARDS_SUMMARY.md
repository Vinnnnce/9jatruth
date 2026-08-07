# Dashboards Summary

Three new Next.js App Router dashboard pages were added to the Soke platform under
`src/app/(dashboard)/`. All pages are client components (`"use client"`), use the
shared `DashboardLayout` (via the existing `(dashboard)/layout.tsx`), TanStack Query
for data fetching/mutations, `apiRequest` from `@/lib/queryClient`, and `useToast`
from `@/components/hooks/use-toast`. They follow the existing project's visual
conventions (`font-display font-700` headers, `tabular-nums` stat figures, small
uppercase muted labels, `Card`/`Badge` patterns) seen in `src/pages/profile.tsx` and
`src/pages/organizations.tsx`.

## Files created

### 1. `src/app/(dashboard)/admin/page.tsx` — Admin Super Dashboard
- Gated on `is_admin` from `GET /api/user/profile` (`isAdmin`/`is_admin` field); shows
  an "Access Denied" card for non-admins and a loading skeleton while the profile
  check is in flight.
- **Overview tab**: 5 stat cards from `GET /api/admin/stats` (total users,
  organizations, truths, rewards distributed, active vacancies) and a recent
  platform-wide activity feed (`GET /api/activity?limit=20`).
- **Users tab**: searchable table of all platform users (`GET /api/admin/users`)
  with inline role `Select` (user/admin/org_admin) and an active/suspend toggle
  `Button`, both calling `PATCH /api/admin/users/[id]` via a `useMutation` that
  invalidates the users query and shows a toast on success/error.
- **Organizations tab**: table of all organizations (`GET /api/organizations`) with
  verification and active/inactive badges.
- **System Health tab**: renders `GET /api/health` — overall status, a per-service
  status grid, and an uptime `Progress` bar.
- Loading states use `Skeleton`; empty states use a shared `EmptyState` helper.
- Components used: `Card`, `Tabs`, `Table`, `Badge`, `Button`, `Select`, `Input`,
  `Avatar`, `Progress`, `Skeleton`.
- Icons: `ShieldCheck`, `Users`, `Building2`, `Newspaper`, `Coins`, `Activity`,
  `TrendingUp`, `AlertCircle`, `CheckCircle2`, plus `Search`/`ShieldAlert` for the
  search box and access-denied state.

### 2. `src/app/(dashboard)/user/page.tsx` — User Dashboard
- Profile card combines `GET /api/user/profile` data with Clerk's `useUser()` hook
  for avatar image, display name, and fallback member-since date.
- **Overview tab**: 5 personal stat boxes (truths submitted, verifications,
  reward balance, trust score, current streak), plus two side-by-side cards with
  the 5 most recent truths (`GET /api/truths?mine=true`) and the 5 most recent
  reward transactions (`GET /api/rewards/ledger`).
- **My Truths tab**: full list of the user's truths.
- **Rewards tab**: large balance display plus the full reward ledger.
- **Achievements tab**: gamification profile from `GET /api/gamification/profile`
  — XP progress bar toward next level, badge grid (earned vs. locked), and an
  achievements list with per-item progress bars and "Done" badges.
- Quick action buttons link to `/submit`, `/feeds`, and `/rewards`.
- Components used: `Card`, `Tabs`, `Progress`, `Badge`, `Button`, `Avatar`,
  `Separator`, `Skeleton`.
- Icons: `User`, `Newspaper`, `Coins`, `Trophy`, `TrendingUp`, `Send`, `Award`,
  `Flame`, `Star`, plus `ShieldCheck`/`Clock` for stats and timestamps.

### 3. `src/app/(dashboard)/org/page.tsx` — Organization/Agency Dashboard
- **Overview tab**: org profile card (name, type, verified badge, description,
  contact email/phone/website) sourced from `GET /api/user/profile`, three summary
  stat cards (member count, active vacancies, org truths count), and a recent
  org-truths list.
- **Members tab**: table of members (`GET /api/org/members`) with role badge,
  a truncated permissions badge list, status, and row actions (edit/remove).
  - **Add Member** dialog (`Dialog`): email, display name, role `Select`, and a
    `Checkbox` grid for the 6 permissions (auto-filled from role defaults, still
    editable); submits via `POST /api/org/members`.
  - **Edit Member** dialog: change role and per-permission checkboxes; submits via
    `PATCH /api/org/members/[id]`.
  - **Remove**: `DELETE /api/org/members/[id]` with a confirmation-free destructive
    icon button (toast confirms the result).
- **Roles & Permissions tab**: a matrix table showing all 6 permissions
  (`manage_members`, `create_vacancies`, `edit_org_profile`, `post_truths`,
  `verify_truths`, `view_analytics`) against the 4 roles (admin/editor/viewer/member)
  with check/cross icons, based on a static `ROLE_PERMISSIONS` map used to seed new
  members' default permissions.
- **Vacancies tab**: list of vacancies (`GET /api/org/vacancies`) as cards with
  category/employment-type/status badges, location, salary, and deadline.
  - **Create/Edit Vacancy** dialog: title, description, category, location,
    employment type `Select`, salary range, multi-line requirements/responsibilities
    textareas (split into arrays on submit), and an application deadline date input.
    Submits via `POST /api/org/vacancies` or `PATCH /api/org/vacancies/[id]`.
  - **Delete**: `DELETE /api/org/vacancies/[id]`.
  - **View Applications** button jumps to the Applications tab pre-filtered to that
    vacancy.
- **Applications tab**: a vacancy `Select` drives `GET
  /api/org/vacancies/[id]/applications`; results render in a `ScrollArea`-wrapped
  table with a per-row status `Select` (pending → reviewed → accepted/rejected)
  that calls a `PATCH` mutation and invalidates the applications query.
- Components used: `Card`, `Tabs`, `Table`, `Badge`, `Button`, `Select`, `Input`,
  `Textarea`, `Label`, `Dialog`, `Checkbox`, `Separator`, `ScrollArea`, `Skeleton`.
- Icons: `Building2`, `Users`, `Briefcase`, `Shield`, `Plus`, `Trash2`, `Edit`,
  `Eye`, `CheckCircle2`, `XCircle`, `Clock`, `UserPlus`, `Key`, `FileText`, plus
  `Mail`/`Phone`/`Globe`/`Newspaper` for the profile/overview sections.

## Shared conventions across all three pages
- TanStack Query `useQuery`/`useMutation`/`useQueryClient`; mutations invalidate the
  relevant query key and surface a `useToast` notification on success/error.
- `Skeleton` loading placeholders and dedicated empty states for every list/table.
- `data-testid` attributes on all interactive elements (buttons, inputs, selects,
  checkboxes, tabs, table rows) for automated testing.
- Responsive layouts via Tailwind (`grid-cols-2 md:grid-cols-*`, `flex-col
  md:flex-row`, horizontally scrollable tables on small screens).
- Dark-mode-safe styling — all colors use theme tokens (`text-muted-foreground`,
  `bg-primary/10`, etc.) or Tailwind color utilities already used elsewhere in the
  codebase (e.g. `text-green-600 dark:text-green-400`).
- TypeScript types defined per-page for API response shapes (`PlatformUser`,
  `Organization`, `RewardLedgerEntry`, `OrgMember`, `Vacancy`, `Application`, etc.).

## Verification performed
- Read and matched conventions from existing files: `src/lib/queryClient.ts`,
  `src/components/dashboard-layout.tsx`, `src/components/hooks/use-toast.ts`,
  `src/lib/api-helpers.ts`, `src/pages/profile.tsx`, `src/pages/organizations.tsx`,
  and the shadcn/ui component exports under `src/components/ui/`.
- Installed project dependencies (`npm install`) and ran `npx tsc --noEmit`. The
  three new files (`admin/page.tsx`, `user/page.tsx`, `org/page.tsx`) produce **zero**
  TypeScript errors.
- The existing type-check run surfaces ~92 pre-existing errors unrelated to this
  task — they come from legacy `src/pages/*`, `src/server/*`, and missing optional
  third-party packages (`wouter`, several `@radix-ui/*` packages, `embla-carousel-react`,
  `jsonwebtoken`, `express` types, etc.) that are not part of the dashboards work and
  were present before these files were added (confirmed by diffing the type-check
  output before/after a clean `node_modules` reinstall — identical error set both
  times).
- `next build` currently fails project-wide due to a **pre-existing, unrelated**
  conflict: legacy Pages Router files under `src/pages/*.tsx` (e.g. `profile.tsx`,
  `organizations.tsx`, `rewards.tsx`, `dashboard.tsx`, etc.) collide with already-migrated
  App Router pages at the same routes. None of the three new dashboard routes
  (`/admin`, `/user`, `/org`) appear in that conflict list — the build blocker is
  unrelated to this task and should be resolved separately (likely by removing the
  legacy `src/pages` directory now that migration to `src/app` is underway).

## Assumptions made (APIs are being built in parallel)
- `GET /api/user/profile` returns an `isAdmin` (or `is_admin`) boolean for the admin
  gate, and for the org dashboard is assumed to double as the org profile payload
  (name, type, verified, description, contact fields) when called by an org admin.
- `GET /api/health` returns `{ status, services?: Record<string,string>, uptime? }`.
- `GET /api/gamification/profile` returns `{ xp, level, nextLevelXp?, badges?, achievements? }`.
- `GET /api/truths` accepts `?mine=true` and `?org=true` query filters for the user
  and org dashboards respectively.
- `GET /api/org/vacancies/[id]/applications` items support a nested
  `PATCH /api/org/vacancies/[id]/applications/[appId]` for status transitions
  (pending → reviewed → accepted/rejected).

These assumptions are isolated to type shapes and query keys; once the real API
routes land, only the TypeScript types and query keys/paths in each page may need
minor alignment.
