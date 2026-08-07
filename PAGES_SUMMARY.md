# Next.js App Router Page Port — Summary

Converted all Vite+wouter pages from `src/pages/` into Next.js App Router routes
under `src/app/(dashboard)/`. Source pages remain untouched in `src/pages/` for reference.

## Conversion rules applied to every file

- Added `"use client";` as the first line of every converted file.
- Replaced `import { Link } from "wouter"` → `import Link from "next/link"`.
- Replaced `import { useLocation } from "wouter"` (used for navigation via
  `setLocation(...)`) → `import { useRouter } from "next/navigation"`, with
  `const [, setLocation] = useLocation();` → `const router = useRouter();` and
  all `setLocation(...)` calls rewritten to `router.push(...)`.
- Replaced `import { useNavigate } from "wouter"` → `import { useRouter } from "next/navigation"` (no occurrences found in the source pages, rule applied defensively).
- Rewrote `useToast` import path: `"@/hooks/use-toast"` → `"@/components/hooks/use-toast"`.
- Left TanStack Query, shadcn/ui, lucide-react, and `apiRequest` (`@/lib/queryClient`) imports untouched.
- Fixed an internal `href="/truths"` link (found in `search.tsx`) to `href="/feeds"` to match the new route.

## Files created

| Source (`src/pages/`) | Destination (`src/app/(dashboard)/...`) | Notes |
|---|---|---|
| `dashboard.tsx` | `dashboard/page.tsx` | Straightforward conversion. |
| `search.tsx` | `search/page.tsx` | `wouter` `Link` → `next/link`; internal `/truths` link updated to `/feeds`. |
| `submit-truth.tsx` | `submit/page.tsx` | Straightforward conversion. |
| `truth-feed.tsx` | `feeds/page.tsx` | **Renamed component to `Feeds`, page `<h1>` changed from "Truth Feed" to "Feeds".** Fetches all posts from `/api/truths` (or `/api/truths/nearby` when location is available), includes `FeedFilterBar`, shows an empty state, and supports category/status/trust filters. |
| `activity.tsx` | `activity/page.tsx` | Straightforward conversion. |
| `trends.tsx` | `trends/page.tsx` | Straightforward conversion. |
| `map.tsx` | `map/page.tsx` | Straightforward conversion. |
| `compare.tsx` | `compare/page.tsx` | Straightforward conversion. |
| `alerts.tsx` | `alerts/page.tsx` | `wouter` `Link` → `next/link`. |
| `predictions.tsx` | `predictions/page.tsx` | Straightforward conversion. |
| `rewards.tsx` | `rewards/page.tsx` | `useToast` import path fixed. |
| `leaderboard.tsx` | `leaderboard/page.tsx` | Straightforward conversion. |
| `profile.tsx` | `profile/page.tsx` | Straightforward conversion. |
| `organizations.tsx` | `organizations/page.tsx` | `useToast` import path fixed. |
| `agency-auth.tsx` | `agency-auth/page.tsx` | `wouter` `useLocation` (navigation) → `useRouter()` + `router.push(...)`; `useToast` import path fixed. |
| `account-settings.tsx` | `account/page.tsx` | `wouter` `useLocation` (navigation) → `useRouter()` + `router.push(...)`; `useToast` import path fixed. |
| `privacy-policy.tsx` | `privacy/page.tsx` | Straightforward conversion. |
| `terms-of-use.tsx` | `terms/page.tsx` | Straightforward conversion. |
| `cookie-policy.tsx` | `cookies/page.tsx` | Straightforward conversion. |
| `operations.tsx` | `operations/page.tsx` | Straightforward conversion. |
| `not-found.tsx` | `not-found.tsx` (App Router special file, not `page.tsx`) | Straightforward conversion. |
| — | `page.tsx` (root of `(dashboard)` group → route `/`) | New file. Imports and re-exports the `Dashboard` component from `dashboard/page.tsx` so `/` renders the dashboard. |
| — | `truths/page.tsx` | New file. Server component using `redirect("/feeds")` from `next/navigation` — old `/truths` route now redirects to `/feeds`. |
| `developer-docs.tsx` | **Not ported** | Deliberately skipped per instructions — no route created for developer docs. |

## Route map (final)

| Route | File |
|---|---|
| `/` | `src/app/(dashboard)/page.tsx` (re-exports Dashboard) |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` |
| `/search` | `src/app/(dashboard)/search/page.tsx` |
| `/submit` | `src/app/(dashboard)/submit/page.tsx` |
| `/feeds` | `src/app/(dashboard)/feeds/page.tsx` |
| `/activity` | `src/app/(dashboard)/activity/page.tsx` |
| `/trends` | `src/app/(dashboard)/trends/page.tsx` |
| `/map` | `src/app/(dashboard)/map/page.tsx` |
| `/compare` | `src/app/(dashboard)/compare/page.tsx` |
| `/alerts` | `src/app/(dashboard)/alerts/page.tsx` |
| `/predictions` | `src/app/(dashboard)/predictions/page.tsx` |
| `/rewards` | `src/app/(dashboard)/rewards/page.tsx` |
| `/leaderboard` | `src/app/(dashboard)/leaderboard/page.tsx` |
| `/profile` | `src/app/(dashboard)/profile/page.tsx` |
| `/organizations` | `src/app/(dashboard)/organizations/page.tsx` |
| `/agency-auth` | `src/app/(dashboard)/agency-auth/page.tsx` |
| `/account` | `src/app/(dashboard)/account/page.tsx` |
| `/privacy` | `src/app/(dashboard)/privacy/page.tsx` |
| `/terms` | `src/app/(dashboard)/terms/page.tsx` |
| `/cookies` | `src/app/(dashboard)/cookies/page.tsx` |
| `/operations` | `src/app/(dashboard)/operations/page.tsx` |
| `/truths` | `src/app/(dashboard)/truths/page.tsx` → redirects to `/feeds` |
| (404 fallback) | `src/app/(dashboard)/not-found.tsx` |
| — | `developer-docs` intentionally not created |

The sidebar navigation config (`src/components/dashboard-layout.tsx`) already
pointed to `/feeds` and all the other new route paths, so no changes were
needed there.

## Verification performed

- Confirmed zero remaining `wouter` imports anywhere under `src/app/(dashboard)/`.
- Confirmed zero remaining `@/hooks/use-toast` imports (all now `@/components/hooks/use-toast`).
- Confirmed every `page.tsx` / `not-found.tsx` starts with `"use client";`.
- Confirmed no `developer-docs` route exists anywhere under `src/app/`.
- Confirmed the `search/page.tsx` `/truths` link was updated to `/feeds`.
- Confirmed `truths/page.tsx` uses `redirect("/feeds")` from `next/navigation`.

## Known pre-existing issue (not part of this port, flagged for awareness)

Several converted pages (and some pre-existing UI components, e.g.
`src/components/ui/sidebar.tsx` and `src/components/ui/toaster.tsx`) import
other hooks from `@/hooks/...` (e.g. `use-agency-auth`, `use-live-location`),
but those hook files physically live in `src/components/hooks/`, not
`src/hooks/` — there is no top-level `src/hooks` directory in this project.
The task only specified fixing the `use-toast` import path, so other
`@/hooks/*` imports were left as-is; this may need a project-wide alias fix or
additional import path corrections outside the scope of this page-porting task.
