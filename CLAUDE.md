# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lab booking system for reserving laboratory servers. Full-stack TypeScript application with React frontend, Node.js backend, and PostgreSQL database.

**Stack**: React 19 · TypeScript · Vite · Node.js · Express · Prisma ORM · PostgreSQL · Docker · Azure Container Apps

## Key Commands

### Local Development

```bash
# Frontend (runs on http://localhost:5173)
npm install
npm run dev

# Backend (runs on http://localhost:3001)
cd backend
npm install
npm run dev
```

### Docker Compose (Full Stack)

```bash
# Start all services (database + backend + frontend)
docker compose up --build -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Start only database
docker compose up database -d
```

### Database (Prisma)

```bash
cd backend

# Generate Prisma Client after schema changes
npx prisma generate

# Create new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Building

```bash
# Frontend production build
npm run build

# Backend build
cd backend
npm run build
npm start
```

## Architecture

### Request Flow

```
Browser → Nginx (port 80)
  ├── /          → React SPA (static files)
  └── /api/*     → Proxy to Express backend (port 3001)
                       ↓
                  Express API
                       ↓
                  Prisma ORM
                       ↓
                  PostgreSQL
```

### Authentication

- **JWT tokens** stored in localStorage (`auth_token`)
- **Session validation**: Every request verifies both JWT signature AND database session existence
- **Session table**: Allows server-side logout (deleting session invalidates token)
- **Middleware**: `backend/src/middleware/auth.ts`
  - `authenticate`: Validates JWT + checks session in DB
  - `requireAdmin`: Ensures user has admin privileges
- **Token format**: `Authorization: Bearer <token>`

### Database Schema (Prisma)

**Models**: `User`, `Session`, `Server`, `Booking`

**Key relationships**:
- Users have many Bookings and Sessions
- Servers have many Bookings
- Bookings belong to User and Server (cascade delete)

**Status enums**:
- ServerStatus: `available | booked | maintenance | offline`
- BookingStatus: `active | completed | cancelled | pending_renewal`

### Frontend State Management

**TanStack Query** for server state:
- `src/hooks/use-booking-data.ts` - All data fetching hooks
- Query keys: `['servers']`, `['bookings']`, `['bookings', 'user', userId]`
- Automatic cache invalidation after mutations

**Local state**:
- Auth state in `useCurrentUser` hook (synced with localStorage)
- Component state with React hooks

### API Client

**Type-safe fetch wrapper**: `src/lib/api.ts`
- Auto-includes JWT token from localStorage
- Parses JSON responses and extracts `data` field
- Error handling with descriptive messages
- APIs: `authApi`, `serversApi`, `bookingsApi`, `usersApi`

## Project Structure

```
lab-reservation-syst/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               # React components
│   │   ├── ui/                   # Shadcn/ui components (Radix UI primitives)
│   │   ├── Dashboard.tsx         # Main dashboard view
│   │   ├── ServerList.tsx        # Server grid display
│   │   ├── BookingDialog.tsx     # Create/extend bookings
│   │   ├── AdminPanel.tsx        # Admin-only views
│   │   └── ...
│   ├── hooks/
│   │   └── use-booking-data.ts   # TanStack Query hooks
│   ├── lib/
│   │   ├── api.ts                # Typed API client
│   │   └── types.ts              # Shared TypeScript types
│   └── App.tsx                   # Root component with routing
│
├── backend/
│   ├── src/
│   │   ├── server.ts             # Express app entry point
│   │   ├── controllers/          # Route handlers
│   │   │   ├── userController.ts     # Auth, register, login
│   │   │   ├── serverController.ts   # CRUD servers
│   │   │   └── bookingController.ts  # CRUD bookings
│   │   ├── routes/               # Express routers
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT + session validation
│   │   │   └── errorHandler.ts   # Global error handler
│   │   └── config/
│   │       ├── database.ts       # Prisma client singleton
│   │       └── logger.ts         # Winston logger
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   ├── migrations/           # SQL migration history
│   │   └── seed.ts               # Seed data (if exists)
│   └── Dockerfile                # Backend container
│
├── Dockerfile                    # Frontend Nginx container
├── nginx.conf                    # Nginx config (SPA routing + /api proxy)
├── docker-compose.yml            # Local dev stack
├── .env.example                  # Environment variables template
└── .github/workflows/
    └── azure-deploy.yml          # CI/CD pipeline
```

## Important Patterns

### Adding a New API Endpoint

1. **Define route**: `backend/src/routes/<resource>Routes.ts`
2. **Create controller**: `backend/src/controllers/<resource>Controller.ts`
3. **Update API client**: Add to `src/lib/api.ts`
4. **Create hook** (optional): Add to `src/hooks/use-booking-data.ts`

### Database Schema Changes

1. Edit `backend/prisma/schema.prisma`
2. Run `cd backend && npx prisma migrate dev --name <description>`
3. Run `npx prisma generate` to update TypeScript types
4. Restart backend dev server

### Admin vs User Routes

- Admin-only routes use: `router.post('/path', authenticate, requireAdmin, controller)`
- User routes use: `router.get('/path', authenticate, controller)`
- Public routes: No middleware (e.g., `/health`, `/ready`, login/register)

### Error Handling

- Backend uses `AppError` class (from `middleware/errorHandler.ts`)
- Throw errors with: `throw new AppError(statusCode, message)`
- Global error handler catches and formats responses
- Frontend API client extracts error messages from response JSON

## Environment Variables

### Backend (`backend/.env` or container env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | 48+ character random string for JWT signing |
| `PORT` | API server port (default: 3001) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | CORS allowed origins (comma-separated) |
| `LOG_LEVEL` | Winston log level: `debug`, `info`, `warn`, `error` |

### Docker Compose (`.env` in root)

| Variable | Description |
|----------|-------------|
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_PORT` | Host port for database (default: 5432) |
| `JWT_SECRET` | Same as backend |
| `BACKEND_PORT` | Host port for backend (default: 3001) |
| `FRONTEND_PORT` | Host port for frontend (default: 80) |

## Deployment

### Azure Container Apps

CI/CD via GitHub Actions (`.github/workflows/azure-deploy.yml`):
- Triggers on push to `main` branch
- Builds backend and frontend Docker images
- Pushes to Azure Container Registry
- Deploys to Azure Container Apps

**Required GitHub Secrets**:
- `ACR_REGISTRY` - ACR login server
- `ACR_USERNAME` - ACR admin username
- `ACR_PASSWORD` - ACR admin password
- `AZURE_RG` - Resource group name
- `AZURE_CREDENTIALS` - Service principal JSON

### Health Checks

- `GET /health` - Basic health check (returns uptime)
- `GET /ready` - Readiness probe (checks database connection)
