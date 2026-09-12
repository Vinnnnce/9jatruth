# 9jatruth Backend

Production-ready NestJS backend for the 9jatruth Nigerian civic-politics platform.

## Overview

9jatruth is a civic-politics platform that enables Nigerians to engage with political discourse at every level — from national to community. The backend provides RESTful APIs for user management, geo-location, political data, community feed, polls, fact-checking, news aggregation, and more.

## Tech Stack

- **Framework**: NestJS 10 (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (access + refresh tokens), Passport
- **Caching**: Redis (ioredis)
- **Rate Limiting**: @nestjs/throttler
- **API Documentation**: Swagger/OpenAPI
- **Scheduled Tasks**: @nestjs/schedule (news fetching)
- **Security**: Helmet, CORS, class-validator
- **Logging**: nestjs-pino (structured logging)

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed data
├── src/
│   ├── main.ts              # Application bootstrap
│   ├── app.module.ts        # Root module
│   ├── prisma/              # Prisma service
│   ├── common/             # Shared utilities
│   │   ├── dto/             # Pagination, API response
│   │   ├── filters/         # Exception filter
│   │   ├── interceptors/    # Logging, transform
│   │   ├── decorators/      # @Roles, @CurrentUser, @Public
│   │   ├── guards/          # JWT, Roles guards
│   │   └── utils/           # Pagination helpers
│   ├── auth/                # Authentication module
│   ├── users/              # User management module
│   ├── geo/                # Geographic data module
│   ├── politics/           # Political data module
│   ├── feed/               # Posts, comments, reactions
│   ├── polls/              # Polling module
│   ├── fact-check/         # Fact-checking module
│   ├── news/               # News aggregation module
│   ├── admin/              # Admin module
│   ├── ai/                 # AI module (scaffolded)
│   └── upload/             # File upload module
├── test/                   # E2E tests
├── Dockerfile              # Multi-stage production build
├── .env.example            # Environment variables template
└── nest-cli.json           # NestJS CLI configuration
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 6+
- npm or yarn

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/9jatruth` |
| `JWT_ACCESS_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `NEWS_API_KEY` | NewsAPI.org API key | - |
| `S3_ENDPOINT` | S3-compatible endpoint | - |
| `S3_BUCKET` | S3 bucket name | - |

### 3. Database Setup

Generate Prisma client:

```bash
npm run prisma:generate
```

Run migrations:

```bash
npm run prisma:migrate
```

Seed the database:

```bash
npm run prisma:seed
```

### 4. Run the Application

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

### 5. Access Swagger Documentation

Once the server is running, visit:

```
http://localhost:3000/docs
```

## API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Logout | Yes |
| GET | `/auth/me` | Get current user | Yes |

### Users (`/api/v1/users`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/users/me` | Get current user profile | Yes |
| PATCH | `/users/me` | Update current user | Yes |
| GET | `/users` | List all users | Admin |
| GET | `/users/:id` | Get user by ID | Yes |
| POST | `/users` | Create user | Admin |
| DELETE | `/users/:id` | Delete user | Super Admin |

### Geo (`/api/v1/geo`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/geo/countries` | List countries |
| GET | `/geo/states` | List states |
| GET | `/geo/states/:id` | Get state with LGAs |
| GET | `/geo/states/:id/lgas` | List LGAs in a state |
| GET | `/geo/lgas/:id/wards` | List wards in an LGA |
| GET | `/geo/wards/:id/communities` | List communities in a ward |

### Politics (`/api/v1/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/parties` | List political parties |
| GET | `/parties/:id` | Get party details |
| GET | `/candidates` | List candidates |
| GET | `/candidates/:id` | Get candidate details |
| GET | `/offices` | List political offices |
| GET | `/elections` | List elections |
| GET | `/elections/:id` | Get election details |

### Feed (`/api/v1/`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/feeds` | Get feed posts with geo filters | No |
| POST | `/posts` | Create a post | Yes |
| GET | `/posts/:id` | Get post with comments/reactions | No |
| PUT | `/posts/:id` | Update a post | Yes |
| DELETE | `/posts/:id` | Delete a post | Yes |
| POST | `/posts/:id/comments` | Add a comment | Yes |
| POST | `/posts/:id/reactions` | Add/update reaction | Yes |

### Polls (`/api/v1/polls`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/polls` | List polls | No |
| GET | `/polls/:id` | Get poll details | No |
| POST | `/polls` | Create a poll | Moderator+ |
| POST | `/polls/:id/vote` | Vote in a poll | Yes |

### Fact Check (`/api/v1/`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/fact-check` | Create a fact check | Moderator+ |
| GET | `/fact-check/:id` | Get fact check by ID | No |
| GET | `/posts/:id/fact-check` | Get fact checks for a post | No |

### News (`/api/v1/news`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/news` | List news articles with filters |

### Admin (`/api/v1/admin`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/stats` | Platform statistics | Admin+ |
| GET | `/admin/reports` | List reports | Admin+ |
| PUT | `/admin/reports/:id` | Resolve a report | Admin+ |
| GET | `/admin/features` | Get feature toggles | Admin+ |
| PUT | `/admin/features/:feature` | Toggle feature | Super Admin |

### AI (`/api/v1/ai`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/ai/ask` | Ask AI assistant (scaffolded) | Yes |
| POST | `/ai/summarize` | Summarize text (scaffolded) | Yes |

### Upload (`/api/v1/upload`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/upload` | Upload a file | Yes |

## User Roles

- **USER**: Default role, can post, comment, react, vote in polls
- **MODERATOR**: Can fact-check posts, create polls, moderate content
- **ADMIN**: Full access to admin endpoints, manage users and political data
- **SUPER_ADMIN**: Full access including feature toggles and deletions

## Testing

Run unit tests:

```bash
npm test
```

Run e2e tests:

```bash
npm run test:e2e
```

Generate coverage report:

```bash
npm run test:cov
```

## Docker

Build and run with Docker:

```bash
docker build -t 9jatruth-backend .
docker run -p 3000:3000 --env-file .env 9jatruth-backend
```

## Seed Data

The seed script creates:

- **Country**: Nigeria
- **States**: Lagos, Abuja FCT, Rivers, Kano
- **LGAs, Wards, Communities** for each state
- **Parties**: APC, PDP, LP, NNPP
- **Offices**: President, Governor, Senator, Representative
- **Election**: 2027 General Elections
- **Users**:
  - Super Admin: `admin@9jatruth.com` / `Admin@123`
  - Test User: `user@9jatruth.com` / `User@123`
- **Sample posts** and a **news article**

## License

MIT
