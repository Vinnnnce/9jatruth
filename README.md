# Soke — Nigeria Digital Ecosystem

A community-driven truth reporting platform for Nigeria, built with Next.js App Router, Clerk authentication, and Neon PostgreSQL.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Authentication**: Clerk (email + Google/Gmail OAuth)
- **Database**: Neon PostgreSQL (serverless)
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **Data Fetching**: TanStack Query v5
- **Charts**: Recharts
- **Icons**: Lucide React

## Features

- **Feeds**: All platform posts displayed in a unified feed with category filters
- **Truth Reporting**: Submit community truth reports (power, fuel, traffic, prices, safety)
- **Verification**: Community-driven truth verification (corroborate, dispute, stale)
- **Trust Scoring**: Automated trust score calculation with time decay
- **Gamification**: XP, levels, achievements, streaks, and reward credits
- **Geo Features**: Location-based feeds, geo-clustering, map visualization
- **Predictions**: AI-powered predictions for neighborhood conditions
- **Dashboards**:
  - **Admin Super Dashboard**: Platform-wide user management, org oversight, system health
  - **User Dashboard**: Personal stats, rewards, achievements, truth history
  - **Organization Dashboard**: Member management, role assignment, vacancy/recruitment notices
- **Organizations**: Partner agencies with verified accounts
- **RBAC**: Role-based access control with granular permissions
- **Vacancies**: Create and manage recruitment notices with applications

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Fill in your DATABASE_URL (Neon), Clerk keys, and other secrets
   ```

3. **Run the dev server**:
   ```bash
   npm run dev
   ```

4. **Set up Clerk**:
   - Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
   - Add your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env`
   - Enable Google/Gmail OAuth in Clerk Dashboard → User & Authentication → Social Connections
   - Set the webhook endpoint to `https://your-domain.com/api/webhook/clerk`

5. **Set up Neon Database**:
   - Create a database at [neon.tech](https://neon.tech)
   - Add your `DATABASE_URL` to `.env`
   - Tables are auto-created on first request

## Deployment (Vercel)

1. Push this repository to GitHub
2. Import the project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Migration Notes

This project was migrated from Vite + Express to Next.js App Router:
- All Express API routes → Next.js Route Handlers
- wouter routing → Next.js App Router
- JWT agency auth → Clerk authentication
- SQLite/Neon dual storage → Neon PostgreSQL only
- Demo data removed — only reference neighborhoods are seeded

## License

MIT
