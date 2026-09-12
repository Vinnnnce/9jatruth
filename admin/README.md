# 9jaTruth Admin Dashboard

A production-ready React admin dashboard for the 9jaTruth Nigerian civic-politics platform. Built with React 18, TypeScript, Vite, Material-UI, Redux Toolkit, and Recharts.

## Features

- **Dashboard** - Analytics overview with stat cards and charts (posts by state, user growth, truth score distribution)
- **Geography Management** - CRUD for States, LGAs, Wards, and Communities
- **Politics Management** - CRUD for Parties, Candidates, Offices, and Elections
- **Moderation** - Posts review, comments review, fact-check management, reports queue
- **News Management** - Create, edit, publish, and archive news articles
- **User Management** - Manage users, assign roles, block/activate accounts
- **Settings** - Feature toggles, general settings, appearance, notification preferences
- **Dark Mode** - Full dark mode support with Nigerian green (#008751) and yellow (#FCD116) theme
- **Role-Based Access** - Protected routes with role-based menu items (SUPER_ADMIN, ADMIN, MODERATOR, ANALYST, EDITOR)
- **Responsive Design** - Works on desktop, tablet, and mobile
- **API Integration** - Axios client with auth token interceptors and automatic refresh

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite 5** - Build tool and dev server
- **Material-UI (MUI) 5** - Component library
- **MUI X DataGrid** - Data tables with sorting, pagination, filtering
- **MUI X Date Pickers** - Date selection
- **Redux Toolkit** - State management
- **React Router 6** - Routing
- **Axios** - HTTP client
- **Recharts** - Charts and visualizations
- **React Hook Form + Yup** - Form handling and validation
- **Notistack** - Toast notifications
- **Day.js** - Date formatting

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

The development server runs on `http://localhost:3001`.

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=9jaTruth Admin
VITE_APP_VERSION=1.0.0
```

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |
| `VITE_APP_NAME` | Application name | `9jaTruth Admin` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |

### Development

```bash
# Start dev server with hot reload
npm run dev

# Type checking
npm run type-check

# Lint
npm run lint
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

The build output is in the `dist/` directory.

### Docker

```bash
# Build the Docker image
docker build -t 9jatruth-admin .

# Run the container
docker run -p 80:80 9jatruth-admin
```

The app will be available at `http://localhost`.

## Project Structure

```
admin/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Main app with routing
│   ├── vite-env.d.ts
│   ├── theme/
│   │   └── theme.ts                # MUI theme (Nigerian colors, dark mode)
│   ├── store/
│   │   ├── store.ts                # Redux store configuration
│   │   ├── hooks.ts                # Typed dispatch/useSelector hooks
│   │   └── slices/
│   │       ├── authSlice.ts        # Auth state (login, logout, refresh)
│   │       └── uiSlice.ts          # UI state (sidebar, dark mode, loading)
│   ├── api/
│   │   ├── client.ts              # Axios instance with interceptors
│   │   ├── authApi.ts             # Auth API endpoints
│   │   ├── geoApi.ts              # Geography CRUD API
│   │   ├── politicsApi.ts         # Politics CRUD API
│   │   ├── feedApi.ts             # Feed/posts/comments API
│   │   ├── moderationApi.ts       # Reports and fact-checks API
│   │   ├── newsApi.ts             # News management API
│   │   ├── statsApi.ts            # Dashboard statistics API
│   │   └── types.ts               # TypeScript types for all entities
│   ├── components/
│   │   ├── Layout.tsx             # Main layout (sidebar + header + content)
│   │   ├── Sidebar.tsx            # Navigation sidebar (role-based)
│   │   ├── Header.tsx             # Top bar (user menu, dark mode, notifications)
│   │   ├── ProtectedRoute.tsx     # Route guard (auth + role checking)
│   │   ├── DataTable.tsx          # Reusable DataGrid wrapper
│   │   ├── ConfirmDialog.tsx      # Confirmation dialog
│   │   ├── PageHeader.tsx         # Page title and actions
│   │   ├── LoadingSpinner.tsx     # Loading indicator
│   │   ├── EmptyState.tsx         # Empty state placeholder
│   │   ├── StatusBadge.tsx        # Status/truth score badge
│   │   └── FormField.tsx          # Reusable form field wrapper
│   ├── pages/
│   │   ├── LoginPage.tsx          # Login form
│   │   ├── DashboardPage.tsx      # Analytics dashboard
│   │   ├── geo/
│   │   │   ├── StatesPage.tsx
│   │   │   ├── LgasPage.tsx
│   │   │   ├── WardsPage.tsx
│   │   │   └── CommunitiesPage.tsx
│   │   ├── politics/
│   │   │   ├── PartiesPage.tsx
│   │   │   ├── CandidatesPage.tsx
│   │   │   ├── OfficesPage.tsx
│   │   │   └── ElectionsPage.tsx
│   │   ├── moderation/
│   │   │   ├── PostsReviewPage.tsx
│   │   │   ├── CommentsReviewPage.tsx
│   │   │   ├── FactCheckPage.tsx
│   │   │   └── ReportsPage.tsx
│   │   ├── news/
│   │   │   └── NewsPage.tsx
│   │   ├── users/
│   │   │   └── UsersPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   └── utils/
│       ├── constants.ts           # Roles, statuses, categories
│       └── format.ts              # Date/number formatting helpers
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── Dockerfile
├── nginx.conf
├── .env.example
└── README.md
```

## User Roles

| Role | Access Level |
|------|-------------|
| SUPER_ADMIN | Full access to all features and settings |
| ADMIN | Access to all management features except settings |
| MODERATOR | Access to moderation features (posts, comments, reports, fact-checks) |
| ANALYST | Access to dashboard and fact-checks |
| EDITOR | Access to dashboard and news management |

## API Proxy

The Vite dev server proxies `/api` requests to `http://localhost:8000` by default. Update the proxy target in `vite.config.ts` if your backend runs on a different port.

## License

© 2024 9jaTruth. All rights reserved.
