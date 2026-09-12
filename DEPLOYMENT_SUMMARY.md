# 9jaTruth - Deployment Summary

## Overview

This document summarizes all changes made across three tasks:
1. Fix loading skeleton and logo overlap on www.9jatruth.com
2. Connect admin dashboard to shared Neon Postgres database via backend APIs
3. Build and prepare Android APK for deployment

---

## Task 1: Loading Skeleton & Logo Overlap Fix

### Problem
The loading skeleton on the feeds and dashboard pages was covering/overlapping the header logo due to `min-h-screen` on skeleton containers and z-index conflicts.

### Files Changed

#### `src/components/logo.tsx`
- Fixed `SokeLogoFull` to properly accept and apply `className` prop
- Added `min-w-0`, `shrink-0`, `whitespace-nowrap` to logo text to prevent clipping
- Added `group-data-[collapsible=icon]:hidden` for collapsed sidebar state

#### `src/app/(dashboard)/feeds/page.tsx`
- Changed `FeedsLoadingSkeleton` from `min-h-screen` to `min-h-[calc(100dvh-4rem)]`
- Added `relative z-0` to main content wrapper

#### `src/app/(dashboard)/dashboard/page.tsx`
- Added `relative z-0` to loading skeleton wrapper

#### `src/app/globals.css`
- Added CSS rules:
  - `.app-header` → `z-index: 40` (ensures header stays above skeleton)
  - `.header-logo` → proper logo positioning
  - `.page-skeleton` → `z-index: 0` (skeleton stays below header)

#### `src/components/dashboard-layout.tsx`
- Changed TopBar z-index from `z-30` to `z-40`
- Added `app-header` class to TopBar
- Added `overflow-hidden` to SidebarHeader to prevent logo overflow
- Added APK download link in SidebarFooter:
  - "Download Android App" → links to `/downloads/9jatruth.apk`
  - "Install Web App" → PWA install prompt

### Key Principle
The skeleton now uses `min-h-[calc(100dvh-4rem)]` (viewport height minus header height) and `z-0`, while the header uses `z-40`, ensuring the skeleton never overlaps the logo/header.

---

## Task 2: Admin Dashboard → Neon Postgres via Backend APIs

### Architecture
```
React Admin Dashboard → Backend REST API (NestJS) → Neon Postgres
```

The admin dashboard does NOT connect directly to the database. All data flows through backend `/admin/*` REST endpoints with role-based authentication.

### Role-Based Auth
- **SUPER_ADMIN**: Full access to all endpoints
- **MODERATOR**: Read-only access to stats, limited moderation actions

### Backend Changes

#### `backend/src/admin/admin.controller.ts`
Added the following endpoints:
- `GET /admin/stats/posts-by-state` - Posts grouped by state
- `GET /admin/stats/user-growth` - User registration growth over time
- `GET /admin/stats/truth-score-distribution` - Truth score distribution
- `GET /admin/stats/top-reported-posts` - Most reported posts
- `GET /admin/reports/:id` - Get single report details
- `GET /admin/posts` - List posts with pagination, filter by status/category
- `PUT /admin/posts/:id/status` - Update post status
- `GET /admin/comments` - List comments with pagination
- `PUT /admin/comments/:id/status` - Update comment status
- `GET /admin/fact-checks` - List fact checks with pagination
- `GET /admin/fact-checks/:id` - Get single fact check
- `POST /admin/fact-checks` - Create fact check
- `PUT /admin/fact-checks/:id` - Update fact check
- `DELETE /admin/fact-checks/:id` - Delete fact check

#### `backend/src/admin/admin.service.ts`
Added corresponding service methods matching the Prisma schema:
- `getPostsByState()` - Groups posts by stateId, enriches with state names
- `getUserGrowth()` - Daily new user counts
- `getTruthScoreDistribution()` - Groups truth scores into ranges
- `getTopReportedPosts(limit)` - Uses Report.groupBy on targetId where targetType=POST
- `getReport(id)` / `resolveReport(id, status)` - Report management
- `getPosts(pagination, status, category)` - Paginated post listing
- `updatePostStatus(id, status)` - Post status update
- `getComments(pagination, status, postId)` - Paginated comment listing
- `updateCommentStatus(id, status)` - Comment status update
- `getFactChecks(pagination)` / `getFactCheck(id)` - Fact check queries
- `createFactCheck(data)` / `updateFactCheck(id, data)` / `deleteFactCheck(id)` - Fact check CRUD

### Admin Dashboard Frontend Changes

#### `admin/src/api/client.ts`
- Added support for `VITE_API_BASE_URL` fallback to `VITE_API_URL`
- Added `withCredentials: true` for cookie-based auth

#### `admin/src/api/statsApi.ts`
- Changed routes from `/stats/*` to `/admin/stats/*`

#### `admin/src/api/moderationApi.ts`
- Changed routes from `/moderation/*` to `/admin/reports/*` and `/admin/fact-checks/*`

#### `admin/src/api/feedApi.ts`
- Changed moderation routes from `/feed/posts/*` to `/admin/posts/*`

#### `admin/src/api/politicsApi.ts`
- Changed route from `/politics/parties` to `/parties` (politics controller has no prefix)

#### `admin/src/api/usersApi.ts` (NEW)
- Created user management API client with CRUD operations on `/users/*`

### Environment Configuration

#### `backend/.env.example`
```
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

#### `admin/.env.example`
```
VITE_API_URL=http://localhost:3000/api/v1
```

---

## Task 3: Android APK Build

### Overview
Built a release APK for the 9jaTruth Android app with signing configuration, using Hilt for DI, Room for local storage, and Jetpack Compose for UI.

### Build Configuration

#### `android/app/build.gradle.kts`
- Added signing config reading from `keystore.properties` or environment variables
- Switched from KSP to KAPT for Hilt and Room (resolves javaslang NoClassDefFoundError)
- Downgraded Hilt from 2.50 to 2.48.1 (known KSP compatibility issue)
- Added R8 dontwarn rules for Error Prone annotations

#### `android/build.gradle.kts`
- Removed KSP plugin (replaced by KAPT)
- Downgraded Hilt plugin from 2.50 to 2.48.1

#### `android/keystore.properties`
- Store file: `9jatruth-release.jks`
- Store password: `9jatruth2024`
- Key alias: `9jatruth-key`
- Key password: `9jatruth2024`

### Compilation Fixes

#### `android/app/src/main/java/com/ninejatruth/app/data/remote/dto/ApiResponse.kt`
- Fixed generic type parameter: removed `M : Any? = Unit` (not supported in Kotlin 1.9)
- Changed to `data class ApiResponse<T, M>`

#### `android/app/src/main/java/com/ninejatruth/app/presentation/`
- Added `import androidx.lifecycle.ViewModel` and `import androidx.lifecycle.viewModelScope` to:
  - `politics/PartyDetailScreen.kt`
  - `politics/ElectionDetailScreen.kt`
  - `politics/CandidateDetailScreen.kt`
  - `news/NewsDetailScreen.kt`
  - `feeds/PostDetailScreen.kt`
- Added `@OptIn(ExperimentalMaterial3Api::class)` to:
  - `profile/ProfileScreen.kt` (ProfileMenuItem)
  - `components/PostCard.kt`
  - `components/QuickActionBar.kt`
- Added missing icon imports in `home/HomeScreen.kt`:
  - `Icons.Filled.Article`, `Icons.Filled.HowToVote`, `Icons.Filled.Forum`, `Icons.Filled.AccountBalance`
- Added missing `dp` import in `components/QuickActionBar.kt`
- Added `background` import in `components/PostCard.kt`
- Fixed `LinearProgressIndicator` overload for Compose BOM 2024.01.00
- Completed `Party` cache mapping with null fields for unavailable data
- Fixed API response metadata type arguments in API interfaces

#### `android/app/src/main/res/drawable/`
- Fixed `?attr/colorControlNormal` → `@color/text_secondary` in:
  - `ic_feeds.xml`, `ic_home.xml`, `ic_news.xml`, `ic_politics.xml`, `ic_profile.xml`

### CI/CD

#### `.github/workflows/android-build.yml` (NEW)
- GitHub Actions workflow that builds the APK on push/PR
- Uses JDK 17, Gradle 8.2, caches dependencies
- Uploads APK as artifact

### Build Commands
```bash
# Environment setup
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

# Generate keystore (one-time)
keytool -genkeypair -v \
  -keystore android/app/9jatruth-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias 9jatruth-key \
  -storepass 9jatruth2024 \
  -keypass 9jatruth2024 \
  -dname "CN=9jaTruth, OU=Dev, O=9jaTruth, L=Lagos, ST=Lagos, C=NG"

# Build release APK
cd android
./gradlew clean assembleRelease --no-daemon --no-configuration-cache

# Output: app/build/outputs/apk/release/app-release.apk
```

### APK Location
- Build output: `android/app/build/outputs/apk/release/app-release.apk`
- Website download: `public/downloads/9jatruth.apk`
- Download link in sidebar footer: `/downloads/9jatruth.apk`

---

## .gitignore Updates

Added entries to prevent committing secrets:
```
# Android signing
android/keystore.properties
android/local.properties
*.jks
*.keystore
```

---

## Verification Results

| Component | Status |
|-----------|--------|
| Web app (Next.js) build | PASS |
| Backend (NestJS) TypeScript | PASS |
| Admin dashboard (Vite) build | PASS |
| Android APK build | PASS (BUILD SUCCESSFUL) |
| APK size | ~2 MB |
| APK location | `android/app/build/outputs/apk/release/app-release.apk` |
