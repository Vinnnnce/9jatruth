#!/bin/bash
# Soke Platform - GitHub Push & Deployment Script
# 
# This script pushes the upgraded Soke platform to GitHub,
# syncs the database schema to Neon, and deploys to Vercel.
#
# Prerequisites:
# 1. GitHub CLI (gh) installed: https://cli.github.com/
# 2. Neon database URL
# 3. Vercel CLI installed: npm i -g vercel
# 4. Prisma CLI: npm i -g prisma
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh

set -e

echo "=========================================="
echo "  Soke Platform Deployment Script"
echo "=========================================="
echo ""

# ─── 1. Push to GitHub ───
echo "[1/3] Pushing to GitHub..."

# Check if we're in the Soke directory
if [ ! -f "package.json" ]; then
  echo "Error: Run this script from the Soke project root directory."
  exit 1
fi

# Create feature branch if not already on it
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "feature/soke-platform-upgrades" ]; then
  git checkout -b feature/soke-platform-upgrades 2>/dev/null || git checkout feature/soke-platform-upgrades
fi

# Push to GitHub
git push origin feature/soke-platform-upgrades

echo "✓ Pushed to GitHub on branch: feature/soke-platform-upgrades"
echo "  Create a Pull Request at: https://github.com/Vinnnnce/Soke/pull/new/feature/soke-platform-upgrades"
echo ""

# ─── 2. Sync Database Schema to Neon ───
echo "[2/3] Syncing database schema to Neon..."

if [ -z "$DATABASE_URL" ]; then
  echo "  Please set your DATABASE_URL environment variable:"
  echo "  export DATABASE_URL='postgres://user:password@ep-xxx.neon.tech/soke?sslmode=require'"
  echo ""
  echo "  Get your connection string from: https://console.neon.tech"
  echo "  Skipping database sync. You can run 'npx prisma db push' manually."
else
  # Generate Prisma client
  npx prisma generate
  
  # Push schema to Neon
  npx prisma db push
  
  echo "✓ Database schema synced to Neon"
fi
echo ""

# ─── 3. Deploy to Vercel ───
echo "[3/3] Deploying to Vercel..."

if ! command -v vercel &> /dev/null; then
  echo "  Installing Vercel CLI..."
  npm install -g vercel
fi

# Deploy to Vercel
vercel --prod

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Merge the Pull Request on GitHub"
echo "2. Set up environment variables in Vercel dashboard:"
echo "   - DATABASE_URL (from Neon)"
echo "   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "   - CLERK_SECRET_KEY"
echo "   - SUPER_ADMIN_EMAIL"
echo "   - VTPASS_API_KEY (for telecom integration)"
echo "   - VTPASS_PUBLIC_KEY"
echo "   - VTPASS_SANDBOX=true"
echo "   - AFRICAS_TALKING_API_KEY (fallback telecom)"
echo "   - NEXT_PUBLIC_IOS_APP_URL"
echo "   - NEXT_PUBLIC_MAPTILER_API_KEY"
echo "3. Run database migrations on Vercel: npx prisma db push"
echo ""
echo "The database tables are created automatically on first request"
echo "via ensureDbInitialized() - no manual SQL needed."
