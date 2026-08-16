# 9jatruth — Eyes on the Street

Community-driven truth reporting platform for Nigeria. Built with Next.js 15, Neon PostgreSQL, Clerk authentication, and Prisma.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk secret key
- `CLERK_WEBHOOK_SECRET` — Clerk webhook signing secret
- `SUPER_ADMIN_EMAIL` — Super admin email (default: insights793@gmail.com)

### 3. Database Setup
The app auto-creates tables on first request via `ensureDbInitialized()`.

**Using Drizzle ORM (default):**
```bash
npm run db:push
```

**Using Prisma (optional):**
```bash
npx prisma generate
npx prisma db push
```

### 4. Sync Services

#### Neon Database
1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string to `DATABASE_URL`
3. The app auto-initializes all tables on first request

#### Clerk Authentication
1. Create an app at [clerk.com](https://clerk.com)
2. Copy publishable key to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. Copy secret key to `CLERK_SECRET_KEY`
4. Set up a webhook endpoint pointing to `/api/webhook/clerk`
5. Copy the webhook signing secret to `CLERK_WEBHOOK_SECRET`
6. Enable Google OAuth in Clerk Dashboard → User & Authentication → Social

#### Vercel Deployment
1. Push the repo to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel project settings
4. Deploy — Vercel auto-detects Next.js and runs `npm run build`

### 5. Super Admin Access
The super admin dashboard is restricted to the email `insights793@gmail.com`.
Only this email can access `/admin` and admin API endpoints.
User dashboard (`/user`) and org dashboard (`/org`) are available based on account type.

### 6. Development
```bash
npm run dev
```

### 7. Build
```bash
npm run build
```

## Features

- **Auto IP Location Detection** — User location is auto-detected via IP address (no manual switch)
- **IP Tracking** — Super admin can track posts and users via IP address
- **Geo-Hierarchical Dashboard** — Analytics structured by community, village, LGA, state, region
- **15 Categories** — Power, Fuel, Traffic, Prices, Safety, Security, Real Estate, Housing, Patrol/Gas Station, Restaurant, Hotel, School, Pharmacy, Hospital, Supermarket
- **Role-Based Dashboards** — Super admin, org admin, and user dashboards based on account type
- **Offline-First** — Mesh sync, push notifications, PWA support
- **Prisma + Drizzle** — Dual ORM support with shared Neon database

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Drizzle ORM + Prisma
- **Auth**: Clerk
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **Deployment**: Vercel
- **Charts**: Recharts
