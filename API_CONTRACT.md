# Soke API Contract — Feed Interactions, Location, Analytics

## Feed Interactions

### Like/Unlike
- `POST /api/truths/{id}/like` → `{ liked: boolean, likeCount: number }` (auth required)
- `DELETE /api/truths/{id}/like` → `{ liked: boolean, likeCount: number }` (auth required)

### Comments
- `GET /api/truths/{id}/comments` → array of `{ id, truthId, userHash, content, parentCommentId, status, createdAt, updatedAt }` (public)
- `POST /api/truths/{id}/comments` → `{ id, truthId, userHash, content, parentCommentId, status, createdAt, updatedAt }` (auth required, body: `{ content: string, parentCommentId?: number }`)

### Share
- `POST /api/truths/{id}/share` → `{ shared: boolean, shareCount: number }` (public, body: `{ channel?: string }`)

### Subscribe
- `POST /api/users/{userHash}/subscribe` → `{ subscribed: boolean, subscriberCount: number }` (auth required)
- `DELETE /api/users/{userHash}/subscribe` → `{ subscribed: boolean, subscriberCount: number }` (auth required)

## Location

### Get Location
- `GET /api/user/location` → `{ detected: { region, city, lat, lng }, preferred: { neighborhoodId, stateName, lgaName, communityName, regionName, lat, lng, source, updatedAt } | null, neighborhoods: [{ id, name, region, lat, lng }] }` (auth required)

### Update Location
- `PUT /api/user/location` → `{ success: boolean, message: string }` (auth required, body: `{ neighborhoodId?, stateName?, lgaName?, communityName?, regionName?, lat?, lng? }`)

## Analytics

### User Analytics
- `GET /api/analytics/user` → `{ stats: { posts, verifications, likesGiven, likesReceived, comments, subscriptions, subscribers, rewardPoints }, postsByCategory: [{ category, count }], postingTrend: [{ date, count }], engagementTrend: [{ date, type, count }], recentPosts: [{ id, category, content, status, createdAt, likeCount, commentCount, shareCount }] }` (auth required)

### Platform Analytics (admin only)
- `GET /api/analytics/overview` → `{ totals: { truths, users, organizations, verifications, likes, comments, shares, subscriptions }, byCategory: [{ category, count }], byRegion: [{ region, count }], byState: [{ state, count }], postsTrend: [{ date, count }], usersTrend: [{ date, count }], topContributors: [{ userHash, count }], verificationRate: { verified, refuted, pending, total }, engagementTrend: [{ date, type, count }] }` (admin only)

## Authentication

- Auth state: use `useUser()` from `@/lib/use-user-safe` → `{ user, isLoaded, isSignedIn }`
- SignedIn/SignedOut components from `@clerk/nextjs`
- SignInButton, SignUpButton from `@clerk/nextjs`
- User hash: fetch from `GET /api/auth/me` → response has `userHash` field

## Existing Components

- `apiRequest(method, url, data)` from `@/lib/queryClient` for API calls
- `useToast()` from `@/components/hooks/use-toast` for notifications
- shadcn/ui: Card, Button, Badge, Textarea, Label, Skeleton, Checkbox, Select
- Recharts already installed
- lucide-react for icons
- Tailwind CSS for styling
