# LabOps Sentinel — Lab Server Booking System

A production-grade executive dashboard for managing and booking laboratory servers, with an autonomous AI-powered monitoring agent and conversational chat assistant.

**Stack**: React 19 · TypeScript · Vite 6 · TailwindCSS 4 · Radix UI · Recharts · Node.js 20 · Express 4 · Prisma 5 · PostgreSQL 16 · Docker · Azure Container Apps

---

## Features

### Core Application

| Page | Description |
|------|-------------|
| **Executive Dashboard** | Donut chart (server status), activity bar chart, architecture filters (ARM64/Intel/AMD + Gen sub-filters), utilization stats, overdue alerts, server grid |
| **Communications** | Send notification form with templates, recipient/subject/message fields · Sent Notifications table with type badges, filtering, and search |
| **Reports & Analytics** | 4 stat cards (bookings, overdue, avg duration, utilization) · Server Status Distribution bar chart · Activity by Action Type chart · Booking History table with filters · Activity Log |
| **Server Management** | Full CRUD · Excel bulk import (.xlsx/.xls/.csv) · Template download · Architecture detection |
| **My Bookings** | View / extend / cancel personal bookings |
| **User Management** | Admin-only user list · Promote/demote admin · Delete users |
| **Admin Panel** | Tabs: Servers, Users, Bookings, Email Digest configuration |

### Smart Agent System (AI-Powered)

| Feature | Description |
|---------|-------------|
| **🤖 Agent Dashboard** | Real-time agent status, system snapshot, AI insights, activity logs with severity badges, manual controls |
| **Autonomous Monitoring** | Runs every 4 hours — checks expiring bookings, auto-completes expired ones, syncs server statuses, analyzes utilization |
| **AI Weekly Summary** | Monday 09:00 UTC — generates LLM-powered utilization analysis and sends to all admins |
| **Booking Reminders** | Auto-detects bookings expiring within 3 days, sends contextual reminder emails with AI insights |
| **Auto-Complete** | Expired bookings automatically marked as completed, servers freed for reuse |
| **Server Status Sync** | Detects and corrects status mismatches (booked with no bookings → available, etc.) |

### Agent Chat Messenger

| Feature | Description |
|---------|-------------|
| **💬 Floating Chat Widget** | Always-visible 🤖 button in bottom-right corner, expandable chat panel |
| **Natural Language Queries** | Ask about available servers, booked servers, GPU/ARM/Intel/AMD servers, expiring bookings, team allocations |
| **Quick Suggestions** | Pre-built query chips for common questions |
| **LLM + Rule-Based** | Uses LLM when configured, falls back to comprehensive rule-based responses |
| **Rich Responses** | Formatted with server specs, status indicators, bullet lists, bold/italic text |

### Additional Capabilities

- JWT authentication with PostgreSQL-backed sessions (7-day expiry)
- Weekly email digest (node-cron, Monday 08:00 UTC) with HTML templates
- Architecture detection from CPU specs (ARM64/Intel/AMD + generation sub-filters)
- Role-based access control (admin vs regular user)
- Excel bulk import/export (servers + bookings, up to 10MB)
- Rate limiting (200 req/15min), Helmet security headers, CORS
- Docker Compose for local full-stack deployment
- Azure Container Apps deployment with CI/CD (GitHub Actions)

---

## Architecture

```
Browser (localhost:5173 dev / port 80 prod)
  │
  ├── React SPA (Vite)
  │     ├── Dashboard, Reports, Communications
  │     ├── Agent Dashboard (monitoring UI)
  │     └── Agent Chat Widget (floating messenger)
  │
  └── /api/* → Express Backend (port 3001)
                  │
                  ├── Auth Middleware (JWT + Session DB check)
                  │
                  ├── /api/users/*      → User & Auth CRUD
                  ├── /api/servers/*    → Server CRUD + status
                  ├── /api/bookings/*   → Booking CRUD + overlap detection
                  ├── /api/admin/*      → Email digest, Excel import/export
                  └── /api/agent/*      → Agent status, logs, chat, manual triggers
                        │
                        ├── Agent Scheduler (cron: every 4h + Mon 09:00)
                        ├── Agent Service (LLM + rule-based intelligence)
                        └── Agent Email Service (reminders, summaries)
                              │
                              ▼
                        PostgreSQL 16
                          ├── users, sessions
                          ├── servers, bookings
                          └── agent_logs
```

---

## Local Development — Step by Step

### Prerequisites

- **Node.js 20+** — [install](https://nodejs.org/)
- **PostgreSQL 16** — running locally or in Docker
- **Git**

### Step 1 — Clone the repo

```bash
git clone https://github.com/kkkashan/lab-reservation-syst.git
cd lab-reservation-syst
```

### Step 2 — Install dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

### Step 3 — Set up PostgreSQL

**Option A: Local PostgreSQL (WSL/Linux/Mac)**

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER labuser WITH PASSWORD 'devpassword123';"
sudo -u postgres psql -c "CREATE DATABASE lab_booking OWNER labuser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lab_booking TO labuser;"
```

**Option B: Docker**

```bash
docker compose up database -d
```

### Step 4 — Configure environment

```bash
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://labuser:devpassword123@localhost:5432/lab_booking"
JWT_SECRET="your-secret-key-change-in-production-minimum-32-chars"
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:5173

# Agent (optional — works without LLM in rule-based mode)
AGENT_ENABLED=true
AGENT_LLM_ENDPOINT=
AGENT_LLM_API_KEY=
AGENT_LLM_MODEL=gpt-4o

# Email (optional — app works without SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
EOF
```

### Step 5 — Run database migrations

```bash
cd backend
npx prisma migrate deploy
cd ..
```

This creates all required tables: `users`, `sessions`, `servers`, `bookings`, `agent_logs`.

### Step 6 — Seed the database (optional)

```bash
cd backend && npm run prisma:seed && cd ..
```

This creates 8 demo users, 24 servers (ARM/Intel/AMD/GPU), and 15 sample bookings.

**Default credentials after seed:**
- Admin: `admin@lab.com` / `password123`
- User: `john@lab.com` / `password123`

### Step 7 — Start the backend

```bash
cd backend && npm run dev
```

You should see:
```
info: PostgreSQL connected
info: 🤖 Agent scheduler started (monitoring every 4h, AI summary Mondays 09:00 UTC)
info: API running on port 3001 [development]
```

### Step 8 — Start the frontend (in a new terminal)

```bash
npm run dev
```

You should see:
```
VITE v6.3.5  ready in ~500ms
➜  Local:   http://localhost:5173/
```

### Step 9 — Open the app

Navigate to **http://localhost:5173** in your browser.

---

## Navigation Guide

| Tab | Access | Description |
|-----|--------|-------------|
| **Dashboard** | All users | Executive dashboard with charts, filters, stats |
| **Communications** | All users | Send and track notifications |
| **Reports** | All users | Analytics, booking history, activity logs |
| **Agent** | All users | 🤖 Agent monitoring dashboard with logs and controls |
| **More → Servers** | All users | Server list with CRUD and Excel import |
| **More → My Bookings** | All users | Personal booking management |
| **More → Users** | Admin only | User management (promote/delete) |
| **More → Admin** | Admin only | Advanced admin panel with email settings |
| **🤖 Chat** | All users | Floating chat widget (bottom-right corner on all pages) |

---

## API Endpoints

### Authentication (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | — | Register new user |
| POST | `/api/users/login` | — | Login (returns JWT + session) |
| POST | `/api/users/logout` | ✅ | Logout (invalidates session) |
| GET | `/api/users/me` | ✅ | Get current user profile |
| GET | `/api/users` | Admin | List all users |
| DELETE | `/api/users/:id` | Admin | Delete a user |
| PATCH | `/api/users/:id/toggle-admin` | Admin | Toggle admin role |

### Servers (`/api/servers`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/servers` | ✅ | List all servers (cached 30s) |
| GET | `/api/servers/:id` | ✅ | Get server by ID |
| POST | `/api/servers` | Admin | Create a server |
| PUT | `/api/servers/:id` | Admin | Update a server |
| DELETE | `/api/servers/:id` | Admin | Delete a server (cascades bookings) |

### Bookings (`/api/bookings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/bookings` | Admin | List all bookings |
| GET | `/api/bookings/user/:userId` | ✅ | List user's bookings |
| POST | `/api/bookings` | ✅ | Create booking (with overlap check) |
| PUT | `/api/bookings/:id/extend` | ✅ | Extend a booking |
| PUT | `/api/bookings/:id/cancel` | ✅ | Cancel a booking |

### Admin (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/email-status` | Admin | Check SMTP configuration |
| POST | `/api/admin/send-weekly-digest` | Admin | Trigger weekly digest manually |
| POST | `/api/admin/send-test-email` | Admin | Send a test email |
| POST | `/api/admin/upload-excel` | Admin | Bulk import servers/bookings from Excel |
| GET | `/api/admin/export-excel` | Admin | Export all data as .xlsx |

### Agent (`/api/agent`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/agent/status` | ✅ | Agent health + system snapshot |
| GET | `/api/agent/logs` | ✅ | Agent activity log (filterable by taskType) |
| POST | `/api/agent/run-cycle` | Admin | Manually trigger full agent monitoring cycle |
| POST | `/api/agent/weekly-summary` | Admin | Manually trigger AI weekly summary |
| POST | `/api/agent/chat` | ✅ | Conversational agent (max 500 chars) |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | — | Basic health check (uptime) |
| GET | `/ready` | — | Readiness probe (checks DB connection) |

---

## Agent Chat — Example Queries

The floating chat widget (🤖 bottom-right) understands natural language queries:

| Query | What it returns |
|-------|-----------------|
| "What servers are available?" | List of all available servers with full specs |
| "Show GPU servers" | All servers with GPU, grouped by availability |
| "Show ARM servers" | ARM/Ampere/Graviton architecture servers |
| "Show Intel servers" | Intel Xeon servers |
| "Show AMD servers" | AMD EPYC/Ryzen servers |
| "Expiring bookings" | Bookings expiring within 3 days |
| "Lab status overview" | Full system snapshot (counts, utilization %) |
| "Team allocations" | Bookings grouped by team |
| "Show booked servers" | Currently booked servers with booking details |
| "Maintenance servers" | Servers in maintenance or offline status |
| "Tell me about SERVER-NAME" | Specific server details + current booking |

---

## Database Schema

### Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| **User** | Authentication & authorization | name, email, password (bcrypt), isAdmin |
| **Session** | JWT session tracking (server-side logout) | userId, token (unique), expiresAt |
| **Server** | Lab servers with specs | name (unique), cpuSpec, memorySpec, storageSpec, gpuSpec, status, location, rscmIp, slotId, fwVersion, dsPool, testHarness, pool |
| **Booking** | Server reservations | serverId, userId, startDate, endDate, purpose, status, daysBooked, teamAssigned, renewalNotificationSent |
| **AgentLog** | Agent monitoring events | taskType, severity, title, detail, aiInsight, metadata (JSON) |

### Enums

| Enum | Values |
|------|--------|
| ServerStatus | `available` · `booked` · `maintenance` · `offline` |
| BookingStatus | `active` · `completed` · `cancelled` · `pending_renewal` |
| AgentTaskType | `booking_expiry_check` · `booking_reminder` · `booking_completed` · `server_status_sync` · `weekly_summary` · `utilization_analysis` · `agent_cycle` |
| AgentSeverity | `info` · `warning` · `action` · `error` |

---

## Docker Compose (Full Stack)

### Prerequisites

- Docker Desktop 4.x+
- Docker Compose v2

```bash
# Create .env from template
cp .env.example .env
# Edit: change DB_PASSWORD, JWT_SECRET

# Start all services
docker compose up --build -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| database | postgres:16-alpine | 5432 | PostgreSQL with persistent volume |
| backend | ./backend | 3001 | Express API + Prisma + Agent Scheduler |
| frontend | . (Nginx) | 80 | React SPA + API proxy |

---

## Deploy on Azure — Step by Step

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- Docker
- An Azure subscription

### Step 1 — Create resource group + ACR

```bash
az login
RG=lab-booking-rg && LOCATION=eastus && ACR_NAME=labbookingacr

az group create --name $RG --location $LOCATION
az acr create --resource-group $RG --name $ACR_NAME --sku Basic --admin-enabled true

ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
```

### Step 2 — Create PostgreSQL

```bash
DB_SERVER=lab-booking-pg && DB_ADMIN=labadmin && DB_PASS=StrongP@ssw0rd123!

az postgres flexible-server create \
  --resource-group $RG --name $DB_SERVER --location $LOCATION \
  --admin-user $DB_ADMIN --admin-password "$DB_PASS" \
  --sku-name Standard_B1ms --tier Burstable --version 16 \
  --storage-size 32 --database-name lab_booking --public-access 0.0.0.0

DATABASE_URL="postgresql://${DB_ADMIN}:${DB_PASS}@${DB_SERVER}.postgres.database.azure.com:5432/lab_booking?sslmode=require"
```

### Step 3 — Build and push images

```bash
docker login $ACR_SERVER -u $ACR_USER -p $ACR_PASS
docker build -t $ACR_SERVER/lab-booking-backend:latest ./backend
docker push $ACR_SERVER/lab-booking-backend:latest
docker build -t $ACR_SERVER/lab-booking-frontend:latest .
docker push $ACR_SERVER/lab-booking-frontend:latest
```

### Step 4 — Deploy Container Apps

```bash
az containerapp env create --name lab-booking-env --resource-group $RG --location $LOCATION

JWT_SECRET=$(openssl rand -base64 48)

# Backend (internal ingress)
az containerapp create \
  --name lab-booking-backend --resource-group $RG --environment lab-booking-env \
  --image $ACR_SERVER/lab-booking-backend:latest \
  --registry-server $ACR_SERVER --registry-username $ACR_USER --registry-password $ACR_PASS \
  --target-port 3001 --ingress internal --min-replicas 1 --max-replicas 3 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars NODE_ENV=production PORT=3001 DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" LOG_LEVEL=info

BACKEND_FQDN=$(az containerapp show --name lab-booking-backend --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)

# Frontend (external ingress)
az containerapp create \
  --name lab-booking-frontend --resource-group $RG --environment lab-booking-env \
  --image $ACR_SERVER/lab-booking-frontend:latest \
  --registry-server $ACR_SERVER --registry-username $ACR_USER --registry-password $ACR_PASS \
  --target-port 80 --ingress external --min-replicas 1 --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

# Set CORS
FRONTEND_FQDN=$(az containerapp show --name lab-booking-frontend --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
az containerapp update --name lab-booking-backend --resource-group $RG \
  --set-env-vars FRONTEND_URL="https://$FRONTEND_FQDN"
```

### Step 5 — CI/CD with GitHub Actions

Add these **GitHub Secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `ACR_REGISTRY` | ACR login server URL |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RG` | Resource group name |
| `AZURE_CREDENTIALS` | `az ad sp create-for-rbac --sdk-auth` JSON output |

After setting secrets, every push to `main` automatically builds, pushes, and deploys.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Min 32-char random string |
| `PORT` | — | `3001` | Backend listen port |
| `NODE_ENV` | — | `development` | `development` or `production` |
| `LOG_LEVEL` | — | `info` | `debug` · `info` · `warn` · `error` |
| `FRONTEND_URL` | — | `*` | CORS allowed origins (comma-separated) |
| `DEMO` | — | `false` | Bypass auth for testing |
| `AGENT_ENABLED` | — | `true` | Enable/disable agent scheduler |
| `AGENT_LLM_ENDPOINT` | — | — | OpenAI-compatible API URL |
| `AGENT_LLM_API_KEY` | — | — | LLM API key |
| `AGENT_LLM_MODEL` | — | `gpt-4o` | LLM model name |
| `SMTP_HOST` | — | — | SMTP server hostname |
| `SMTP_PORT` | — | `587` | SMTP port |
| `SMTP_USER` | — | — | SMTP username |
| `SMTP_PASS` | — | — | SMTP password |
| `SMTP_FROM` | — | SMTP_USER | Sender email address |

### Docker Compose (`.env` in root)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_NAME` | `lab_booking` | PostgreSQL database name |
| `DB_USER` | `labuser` | PostgreSQL username |
| `DB_PASSWORD` | _(required)_ | PostgreSQL password |
| `DB_PORT` | `5432` | Host port for database |
| `JWT_SECRET` | _(required)_ | Min 32-char random string |
| `BACKEND_PORT` | `3001` | Host port for backend |
| `FRONTEND_PORT` | `80` | Host port for frontend |

---

## Project Structure

```
lab-reservation-syst/
├── src/                              # React frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── Navigation.tsx            # Header nav with tabs + More dropdown
│   │   ├── Dashboard.tsx             # Executive dashboard (charts, stats, filters)
│   │   ├── Communications.tsx        # Notification form + history
│   │   ├── Reports.tsx               # Reports & Analytics
│   │   ├── AgentDashboard.tsx        # 🤖 Agent monitoring dashboard
│   │   ├── AgentChat.tsx             # 🤖 Floating chat widget
│   │   ├── ServerList.tsx            # Server management + Excel import
│   │   ├── ServerCard.tsx            # Server card component
│   │   ├── ServerDetailsDialog.tsx   # Server detail modal
│   │   ├── MyBookings.tsx            # Personal booking management
│   │   ├── UserManagement.tsx        # Admin user management
│   │   ├── AdminPanel.tsx            # Admin panel (Servers/Users/Bookings/Email)
│   │   ├── LoginForm.tsx             # Authentication page
│   │   ├── AddServerDialog.tsx       # Add/edit server dialog
│   │   ├── BookingDialog.tsx         # Create booking dialog
│   │   ├── ExcelUploadDialog.tsx     # Excel file upload
│   │   └── ui/                       # 40+ shadcn/ui Radix components
│   ├── hooks/
│   │   ├── use-booking-data.ts       # TanStack Query hooks
│   │   └── use-mobile.ts            # Mobile breakpoint detection
│   ├── lib/
│   │   ├── api.ts                    # Typed API client (auth, servers, bookings, agent, admin)
│   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   ├── booking-utils.ts          # Booking helper functions
│   │   └── utils.ts                  # General utilities
│   ├── App.tsx                       # Root component with routing
│   └── main.tsx                      # Vite entry point
│
├── backend/
│   ├── src/
│   │   ├── server.ts                 # Express entry point (env validation, route mounting)
│   │   ├── config/
│   │   │   ├── constants.ts          # App-wide constants
│   │   │   ├── database.ts           # Prisma Client singleton
│   │   │   └── logger.ts            # Winston logger configuration
│   │   ├── controllers/
│   │   │   ├── userController.ts     # Auth + user CRUD
│   │   │   ├── serverController.ts   # Server CRUD with status
│   │   │   ├── bookingController.ts  # Booking CRUD with overlap detection
│   │   │   └── uploadController.ts   # Excel import/export
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT + session validation, requireAdmin
│   │   │   ├── cacheHeaders.ts       # Cache-Control headers
│   │   │   └── errorHandler.ts       # Global error handler (AppError class)
│   │   ├── routes/
│   │   │   ├── userRoutes.ts         # /api/users/*
│   │   │   ├── serverRoutes.ts       # /api/servers/*
│   │   │   ├── bookingRoutes.ts      # /api/bookings/*
│   │   │   ├── adminRoutes.ts        # /api/admin/*
│   │   │   └── agentRoutes.ts        # /api/agent/* (status, logs, chat, triggers)
│   │   └── services/
│   │       ├── emailService.ts       # Nodemailer + SMTP + digest templates
│   │       ├── scheduler.ts          # node-cron weekly digest (Mon 08:00 UTC)
│   │       ├── agentService.ts       # 🤖 LLM-powered monitoring + chat handler
│   │       ├── agentEmailService.ts  # Agent email templates (reminders, summaries)
│   │       └── agentScheduler.ts     # Agent cron jobs (4h cycle + Mon 09:00)
│   ├── prisma/
│   │   ├── schema.prisma             # DB schema (User, Session, Server, Booking, AgentLog)
│   │   ├── migrations/               # SQL migration history
│   │   └── seed.ts                   # Demo data seeder
│   ├── Dockerfile                    # Backend container image
│   └── package.json
│
├── Dockerfile                        # Frontend Nginx production image
├── nginx.conf                        # Nginx config (SPA + /api proxy)
├── nginx.conf.template               # Dynamic Nginx config (BACKEND_URL envsubst)
├── docker-compose.yml                # Local full-stack (DB + backend + frontend)
├── .env.example                      # Environment template
├── CLAUDE.md                         # AI assistant guidance
├── plan.md                           # Project roadmap & change log
├── vite.config.ts                    # Vite config + API proxy
├── tailwind.config.js                # TailwindCSS configuration
├── tsconfig.json                     # TypeScript config
├── package.json                      # Frontend dependencies
└── .github/workflows/
    └── azure-deploy.yml              # CI/CD (build → ACR → Azure Container Apps)
```

---

## Security Checklist (before production)

- [ ] Change default admin password
- [ ] Set `JWT_SECRET` to a random 48-byte base64 string (`openssl rand -base64 48`)
- [ ] Set `DB_PASSWORD` to a strong password
- [ ] Restrict PostgreSQL public access to backend IP only
- [ ] Enable HTTPS (Azure Container Apps provides TLS by default)
- [ ] Set `NODE_ENV=production` on all containers
- [ ] Review `FRONTEND_URL` CORS — do not use `*` in production
- [ ] Configure `AGENT_LLM_API_KEY` for AI-powered insights (optional)
- [ ] Enable Azure Defender for Containers

---

## Useful Commands

```bash
# Start locally (development)
cd backend && npm run dev &       # Backend on :3001
npm run dev                       # Frontend on :5173

# Restart services
lsof -t -i:3001 -i:5173 | xargs kill -9 2>/dev/null
cd backend && npm run dev &
npm run dev

# Check service status
curl -s http://localhost:3001/health | python3 -m json.tool
curl -s http://localhost:5173 | head -1

# Database management
cd backend && npx prisma studio   # GUI browser
cd backend && npx prisma migrate reset  # Reset database

# Test agent chat
TOKEN=$(curl -s -X POST http://localhost:3001/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@lab.com","password":"password123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"What servers are available?"}' | python3 -m json.tool

# Azure logs
az containerapp logs show --name lab-booking-backend --resource-group lab-booking-rg --follow

# Tear down Azure
az group delete --name lab-booking-rg --yes --no-wait
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED :5432` | Start PostgreSQL: `sudo service postgresql start` |
| `ECONNREFUSED :3001` | Start backend: `cd backend && npm run dev` |
| Port already in use | Kill process: `kill $(lsof -ti:<port>)` |
| 401 on API calls | Re-login — JWT session may have expired (7-day expiry) |
| Agent chat returns "Route not found" | Restart backend — nodemon may not have detected WSL file changes |
| SMTP not configured warning | Normal if email env vars aren't set — app works without email |
| Agent LLM not configured | Normal — agent uses rule-based mode without LLM credentials |
| Excel import fails | Ensure columns match template: name, cpu_spec, memory_spec, etc. |
| Migration lock mismatch | Check `backend/prisma/migrations/migration_lock.toml` says `provider = "postgresql"` |

---

## License

MIT
