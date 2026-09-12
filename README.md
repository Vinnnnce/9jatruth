# 9jatruth — Eyes on the Street

A Nigerian civic-politics and community platform combining state/LGA/ward/community-based feeds, political tracking, news, community discussions, polls, and trust-oriented truth scoring and fact-checking.

## Monorepo Structure

```
9jatruth/
├── backend/          # NestJS API (TypeScript, Prisma, PostgreSQL, Redis)
├── android/          # Android app (Kotlin, Jetpack Compose, Hilt)
├── admin/            # Admin dashboard (React, TypeScript, MUI)
├── .github/workflows/  # CI/CD pipelines
├── docker-compose.yml  # Full local development stack
└── README.md
```

## Tech Stack

| Component     | Technology                                           |
|---------------|------------------------------------------------------|
| Backend API   | NestJS, TypeScript, Prisma ORM, PostgreSQL, Redis    |
| Android App   | Kotlin, Jetpack Compose, Hilt, Retrofit, Room         |
| Admin Web     | React, TypeScript, Vite, MUI, Redux Toolkit           |
| DevOps        | Docker, Docker Compose, GitHub Actions               |
| Storage       | S3-compatible (MinIO for local, AWS S3 for prod)     |

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- JDK 17 (for Android)
- Android SDK (for Android)

### 1. Full Stack with Docker Compose

```bash
# Clone the repository
git clone https://github.com/Vinnnnce/9jatruth.git
cd 9jatruth

# Copy environment file and configure
cp .env.example .env
# Edit .env with your secrets

# Start all services
docker-compose up -d

# Backend API:    http://localhost:3001
# Admin Dashboard: http://localhost:3002
# API Docs:       http://localhost:3001/api/docs
# MinIO Console:  http://localhost:9001
```

### 2. Backend Development

```bash
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL, REDIS_URL, JWT secrets

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Start dev server
npm run start:dev
```

### 3. Admin Dashboard Development

```bash
cd admin
npm install
cp .env.example .env
# Set VITE_API_URL to your backend URL

npm run dev
```

### 4. Android App Development

```bash
cd android
# Open in Android Studio or build from CLI:
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

## Default Credentials

After seeding the database:
- **Super Admin:** admin@9jatruth.com / Admin@123
- **Test User:** test@9jatruth.com / Test@123

## Domain Model Overview

### Geo Hierarchy
Country → State → LGA → Ward → Community

### Core Entities
- **User** — with roles (USER, MODERATOR, ADMIN, SUPER_ADMIN) and geo location
- **Party** — political parties (APC, PDP, LP, etc.)
- **Candidate** — candidates with party, office, manifesto, truth badges
- **Election** — elections with timeline, level, geo scope
- **Post** — geo-scoped community posts with media, tags, truth score
- **Poll** — community polls with geo scope
- **FactCheck** — fact-check items with sources and status
- **TruthScore** — 0-100 score with algorithm metadata
- **NewsArticle** — news from external APIs with geo scope and categories

## API Endpoints

| Module      | Base Path     | Key Endpoints                                   |
|-------------|---------------|-------------------------------------------------|
| Auth        | /auth         | register, login, refresh, logout, me            |
| Users       | /users        | me, update, list (admin), get by id             |
| Geo         | /geo          | countries, states, lgas, wards, communities      |
| Politics    | /parties, /candidates, /offices, /elections | CRUD + list       |
| Feed        | /feeds, /posts | list with geo filters, create, comments, reactions |
| Polls       | /polls        | create, vote, list with geo filters             |
| Fact Check  | /fact-check   | create, get by post                             |
| News        | /news         | list with category/state filters                |
| Admin       | /admin        | stats, reports, user management                 |
| AI          | /ai           | ask (scaffolded for LLM integration)            |

Full API documentation available at `/api/docs` (Swagger UI) when backend is running.

## CI/CD

GitHub Actions workflows automatically:
- **Backend:** lint, test, build, Prisma migrate on push to main/develop
- **Admin:** lint, build on push to main/develop
- **Android:** lint, build APK, unit tests on push to main/develop

## Security Features

- bcrypt password hashing
- JWT access + refresh tokens
- Role-based access control (RBAC)
- Rate limiting on auth endpoints
- Input validation on all DTOs
- Helmet.js security headers
- EncryptedSharedPreferences on Android
- S3-compatible file storage

## License

MIT
