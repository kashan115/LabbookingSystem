# LabOps Sentinel — Project Plan & Change Log

## Table of Contents

- [Project Vision](#project-vision)
- [Change Log](#change-log)
- [Current State](#current-state)
- [Architecture Decisions](#architecture-decisions)
- [Feature Breakdown](#feature-breakdown)
- [Roadmap](#roadmap)
- [Known Issues](#known-issues)
- [Configuration Guide](#configuration-guide)

---

## Project Vision

LabOps Sentinel is a full-stack lab server booking system designed for engineering teams that need to schedule and manage access to shared laboratory servers. The system provides:

1. **Self-service booking** — Users browse available servers, book with purpose/team, extend or cancel
2. **Admin oversight** — Dashboard with utilization metrics, server management, user management
3. **Autonomous monitoring** — AI-powered agent that auto-completes expired bookings, sends reminders, analyzes usage patterns
4. **Conversational assistant** — Chat widget for quick queries about server availability, bookings, and lab status
5. **Production deployment** — Docker Compose for local dev, Azure Container Apps for cloud, CI/CD via GitHub Actions

---

## Change Log

### Phase 1 — Core Application (Initial Build)

**Authentication & User Management**
- [x] JWT-based authentication with PostgreSQL-backed sessions
- [x] 7-day token expiry with server-side session validation
- [x] User registration with password validation (8+ chars, uppercase, lowercase, digit)
- [x] Bcrypt password hashing (12 rounds)
- [x] Admin role with toggle promotion/demotion
- [x] User deletion with cascade (sessions + bookings)
- [x] Demo mode (`DEMO=true`) for testing without auth

**Server Management**
- [x] Full CRUD for lab servers
- [x] Detailed specs: CPU, memory, storage, GPU, location
- [x] Extended metadata: RSCM IP, slot ID, firmware version, DS pool, test harness, pool
- [x] Server status management: available / booked / maintenance / offline
- [x] 30-second cache on server list (stable data optimization)
- [x] Architecture detection from CPU specs (ARM64 / Intel / AMD + generation sub-filters)

**Booking System**
- [x] Create bookings with server selection, date range, purpose, team assignment
- [x] 3-way overlap detection (start overlap, end overlap, full containment)
- [x] Booking extension with day recalculation
- [x] Booking cancellation with automatic server status update
- [x] Status tracking: active / completed / cancelled / pending_renewal
- [x] Renewal notification flag to prevent reminder spam

**Frontend**
- [x] Executive Dashboard — donut chart, activity bar chart, architecture filters, server grid
- [x] Communications page — notification form with templates, sent history
- [x] Reports & Analytics — stat cards, charts, booking history table, activity log
- [x] Server Management — CRUD, detail modals, status badges
- [x] My Bookings — personal booking list with extend/cancel
- [x] User Management — admin user list, promote/demote, delete
- [x] Admin Panel — tabbed interface (Servers, Users, Bookings, Email)
- [x] Login/Register — form with validation

### Phase 2 — Email & Excel

**Email Digest System**
- [x] Nodemailer integration with configurable SMTP
- [x] Weekly digest email (Monday 08:00 UTC via node-cron)
- [x] HTML email templates with active bookings, expiring alerts, available server count
- [x] Graceful degradation when SMTP not configured
- [x] Manual digest trigger from Admin panel
- [x] Test email functionality

**Excel Import/Export**
- [x] Bulk import from .xlsx / .xls / .csv (up to 10MB)
- [x] Case-insensitive column matching
- [x] Upsert logic — create new servers, update existing by name
- [x] Booking creation from Excel (user_email + dates)
- [x] Excel date serial number conversion
- [x] Export all servers + active bookings as .xlsx
- [x] Template download for bulk import

### Phase 3 — Smart Agent System

**Agent Service** (`backend/src/services/agentService.ts`)
- [x] Autonomous monitoring cycle (every 4 hours)
- [x] Task 1: Expiring booking detection (≤3 days to expiry)
  - Generates AI insight when LLM configured
  - Sends reminder email via agentEmailService
  - Sets booking status to `pending_renewal`
  - Marks `renewalNotificationSent = true`
- [x] Task 2: Auto-complete expired bookings
  - Marks `status → completed` when `endDate < now`
  - Frees server if no other active bookings
  - Sends expiration notification email
- [x] Task 3: Server status sync
  - Fixes "booked" servers with no active bookings → "available"
  - Fixes "available" servers with active bookings → "booked"
- [x] Task 4: Utilization analysis
  - Calculates total/available/booked/maintenance/offline counts
  - Utilization % = (booked / total) × 100
  - Groups by team and architecture
  - LLM-generated insights or rule-based fallback

**Agent Scheduler** (`backend/src/services/agentScheduler.ts`)
- [x] Cron: monitoring cycle every 4 hours
- [x] Cron: AI weekly summary Mondays 09:00 UTC
- [x] Graceful start/stop
- [x] Configurable via `AGENT_ENABLED` env var

**Agent Email Service** (`backend/src/services/agentEmailService.ts`)
- [x] Booking reminder email template (with AI insight)
- [x] Booking expired email template
- [x] AI weekly summary email template (sent to all admins)

**Agent API** (`backend/src/routes/agentRoutes.ts`)
- [x] `GET /api/agent/status` — agent health + system snapshot
- [x] `GET /api/agent/logs` — activity log (filterable, max 200)
- [x] `POST /api/agent/run-cycle` — manual trigger (admin only)
- [x] `POST /api/agent/weekly-summary` — manual AI summary (admin only)

**Agent Dashboard** (`src/components/AgentDashboard.tsx`)
- [x] Agent status card (enabled/disabled, LLM status, email status)
- [x] System snapshot (server counts, active bookings, expiring count)
- [x] Last cycle info with AI insight display
- [x] 24-hour activity summary (actions, warnings, errors)
- [x] Activity log table with severity badges and task type filters
- [x] Manual trigger buttons (Run Cycle, Weekly Summary) for admins

**Agent Logging** (database model `AgentLog`)
- [x] Task types: booking_expiry_check, booking_reminder, booking_completed, server_status_sync, weekly_summary, utilization_analysis, agent_cycle
- [x] Severity levels: info, warning, action, error
- [x] Structured metadata as JSON
- [x] AI insight storage (text)
- [x] Indexed by taskType, severity, createdAt

**LLM Integration**
- [x] OpenAI-compatible API support (configurable endpoint)
- [x] Configurable model (default: gpt-4o)
- [x] Rule-based fallback when LLM not configured
- [x] Used for: utilization insights, booking reminder context, weekly summaries, chat responses

### Phase 4 — Agent Chat Messenger

**Chat Backend** (`handleAgentChat` in `agentService.ts`)
- [x] `POST /api/agent/chat` — authenticated endpoint, max 500 chars
- [x] Context gathering: queries live database for servers, bookings, users
- [x] LLM pass-through when configured (database context injected into prompt)
- [x] Comprehensive rule-based response engine:
  - Available servers (with full specs)
  - Booked servers (with booking details)
  - Expiring bookings (≤3 days)
  - GPU server filter
  - ARM/Ampere/Graviton server filter
  - Intel Xeon server filter
  - AMD EPYC/Ryzen server filter
  - Specific server lookup by name
  - Lab status overview (counts + utilization %)
  - Team allocations (bookings grouped by team)
  - Maintenance/offline servers
  - Help/fallback with available commands

**Chat Frontend** (`src/components/AgentChat.tsx`)
- [x] Floating 🤖 button (bottom-right corner, visible on all pages)
- [x] Expandable chat panel (400×560px)
- [x] Gradient header with online status indicator
- [x] Message history with user/agent styling
- [x] Typing indicator (animated dots)
- [x] Quick suggestion chips (first interaction)
- [x] Simple markdown rendering (bold, italic, bullet points)
- [x] Enter to send, auto-scroll to latest
- [x] Error handling with user-friendly messages

**Chat API** (`src/lib/api.ts`)
- [x] `agentApi.chat(message)` — typed POST request
- [x] Returns `{ reply: string }` response

---

## Current State

### What's Working (April 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend (React + Vite) | ✅ Running | Port 5173, all pages functional |
| Backend (Express + Prisma) | ✅ Running | Port 3001, all endpoints active |
| PostgreSQL | ✅ Connected | Local instance, seeded with demo data |
| Authentication | ✅ Working | JWT + session validation |
| Server CRUD | ✅ Working | 24 demo servers with diverse specs |
| Booking CRUD | ✅ Working | 15 demo bookings, overlap detection |
| Agent Scheduler | ✅ Running | 4h cycle + weekly summary cron |
| Agent Dashboard | ✅ Working | Status, logs, manual controls |
| Agent Chat | ✅ Working | Rule-based responses (LLM optional) |
| Email System | ⚠️ Unconfigured | Working code, no SMTP credentials set |
| LLM Integration | ⚠️ Unconfigured | Working code, no API key set |
| Docker Compose | ⚠️ Not tested | Docker not available in current WSL env |
| Azure Deployment | ⚠️ Not deployed | CI/CD pipeline ready, not triggered |

### Demo Data

- **8 Users**: 1 admin (admin@lab.com), 7 regular users
- **24 Servers**: ARM (Ampere, Graviton, Neoverse), Intel (Xeon ICX/SPR/EMR), AMD (EPYC/Ryzen), Edge IoT
- **15 Bookings**: Mix of active, completed, cancelled
- **Agent Logs**: Auto-populated from monitoring cycles

### Key Credentials (Development Only)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lab.com | password123 |
| User | john@lab.com | password123 |
| User | jane@lab.com | password123 |
| User | gpu-researcher@lab.com | password123 |

---

## Architecture Decisions

### Why JWT + Session DB (not just JWT)?

JWT alone doesn't support server-side logout. By storing sessions in PostgreSQL, we can:
- Invalidate tokens on logout (delete session row)
- List active sessions per user
- Enforce single-session or session limits in the future

### Why Rule-Based + LLM Hybrid (not LLM-only)?

- LLM APIs have latency (1-5s per call) and cost money
- Many queries are structured (list available servers) and don't need AI
- Rule-based responses are instant and free
- LLM enriches responses when configured (insights, natural language summaries)
- System degrades gracefully — fully functional without LLM

### Why Agent Scheduler (not real-time WebSocket)?

- Lab bookings don't require real-time monitoring (hours, not seconds)
- 4-hour cycle is sufficient for expiry checks
- Simpler architecture — no WebSocket server to maintain
- Lower resource usage — polling vs persistent connections

### Why Prisma (not raw SQL)?

- Type-safe queries with TypeScript integration
- Automatic migration management
- Schema-first approach with generated client
- Easy to switch databases if needed
- Prisma Studio for quick database browsing

### Why TanStack Query (not Redux/Zustand)?

- Server state management (not client state)
- Automatic cache invalidation after mutations
- Built-in loading/error states
- Stale-while-revalidate pattern
- No boilerplate actions/reducers

---

## Feature Breakdown

### Authentication Flow

```
Register → Hash password (bcrypt) → Store user → Return user info
Login → Verify password → Create session (UUID + 7d expiry) → Sign JWT → Return token
API Request → Extract Bearer token → Verify JWT signature → Check session in DB → Proceed
Logout → Delete session row → Token becomes invalid
```

### Agent Monitoring Cycle

```
Every 4 hours:
  1. Check expiring bookings (≤3 days)
     → Send reminder email + AI insight
     → Mark as pending_renewal
  2. Complete expired bookings (endDate < now)
     → Mark as completed
     → Free server (if no other bookings)
     → Send expiration email
  3. Sync server statuses
     → Fix mismatches (booked↔available)
  4. Analyze utilization
     → Calculate % utilization
     → Group by team/architecture
     → Generate AI insight (or rule-based)
  5. Log results to AgentLog table
```

### Agent Chat Flow

```
User types message → POST /api/agent/chat
  → Validate (non-empty, ≤500 chars)
  → If LLM configured:
      → Gather database context (servers, bookings, stats)
      → Build system prompt with context
      → Call LLM API with user message
      → Return AI response
  → Else (rule-based):
      → Pattern match message keywords
      → Query relevant database tables
      → Format structured response with specs/details
      → Return formatted response
```

---

## Roadmap

### Short-Term (Next Sprint)

| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 High | SMTP Configuration | Set up email credentials for reminders & digests |
| 🔴 High | LLM API Key | Configure OpenAI/Azure OpenAI for AI insights |
| 🟡 Medium | Docker Testing | Verify Docker Compose works end-to-end |
| 🟡 Medium | Azure Deployment | Deploy to Azure Container Apps via CI/CD |
| 🟡 Medium | Chat History Persistence | Store chat messages in database per user |
| 🟢 Low | Chat Streaming | Stream LLM responses token-by-token |

### Medium-Term (Next Month)

| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 High | Booking Approval Workflow | Admin approval for high-value servers |
| 🔴 High | Calendar View | Visual calendar for server availability |
| 🟡 Medium | Slack/Teams Integration | Send notifications to team channels |
| 🟡 Medium | Multi-Cluster Support | Manage servers across multiple labs/sites |
| 🟡 Medium | Server Health Monitoring | Ping servers, track uptime, alert on failures |
| 🟢 Low | Dark/Light Theme | User-selectable theme (currently dark) |
| 🟢 Low | Mobile Responsive | Optimize for tablet/phone screens |

### Long-Term (Quarterly)

| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 High | RBAC Expansion | Team leads, viewers, operators roles |
| 🔴 High | Audit Trail | Complete audit log for compliance |
| 🟡 Medium | Resource Quotas | Per-team or per-user booking limits |
| 🟡 Medium | Cost Allocation | Track server usage costs by team |
| 🟡 Medium | API Rate Limiting (per-user) | More granular rate limiting |
| 🟢 Low | Plugin System | Custom integrations via webhook/plugin |
| 🟢 Low | Self-Hosted LLM | Run local model (Ollama/vLLM) for air-gapped envs |

---

## Known Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| Nodemon doesn't detect WSL file changes | Backend doesn't auto-restart on code change | Manually kill & restart: `kill $(lsof -ti:3001) && cd backend && npm run dev` |
| Stale JWT after database reseed | 401 errors on API calls | Log out and log back in |
| Docker Compose not tested | Can't verify container deployment locally | Run natively with Node.js + local PostgreSQL |
| Chat history not persisted | Messages lost on page refresh | Planned for future sprint |
| No WebSocket for real-time updates | Dashboard doesn't auto-refresh | Manual refresh or TanStack Query refetch interval |
| Email features untested with real SMTP | Can't verify email delivery | Configure SMTP credentials and test |

---

## Configuration Guide

### Minimal Setup (Development)

```bash
# backend/.env — minimum required
DATABASE_URL="postgresql://labuser:devpassword123@localhost:5432/lab_booking"
JWT_SECRET="your-secret-key-change-in-production-minimum-32-chars"
PORT=3001
NODE_ENV=development
```

### Full Setup (with Agent AI + Email)

```bash
# backend/.env — all features enabled
DATABASE_URL="postgresql://labuser:devpassword123@localhost:5432/lab_booking"
JWT_SECRET="your-secret-key-change-in-production-minimum-32-chars"
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:5173

# Agent AI
AGENT_ENABLED=true
AGENT_LLM_ENDPOINT=https://api.openai.com/v1/chat/completions
AGENT_LLM_API_KEY=sk-your-api-key-here
AGENT_LLM_MODEL=gpt-4o

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=labops@company.com
SMTP_PASS=app-password
SMTP_FROM="LabOps Sentinel <labops@company.com>"
```

### Production Setup

```bash
# backend/.env — production
DATABASE_URL="postgresql://admin:StrongP@ss@db-server.postgres.database.azure.com:5432/lab_booking?sslmode=require"
JWT_SECRET="$(openssl rand -base64 48)"
PORT=3001
NODE_ENV=production
LOG_LEVEL=warn
FRONTEND_URL=https://labops.company.com

AGENT_ENABLED=true
AGENT_LLM_ENDPOINT=https://your-azure-openai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-01
AGENT_LLM_API_KEY=your-azure-openai-key
AGENT_LLM_MODEL=gpt-4o

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=labops@company.com
SMTP_PASS=app-password
SMTP_FROM="LabOps Sentinel <labops@company.com>"
```

---

## Tech Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19.0.0 | UI framework |
| | TypeScript | 5.7 | Type safety |
| | Vite | 6.3.5 | Build tool + dev server |
| | TailwindCSS | 4.1 | Utility-first CSS |
| | Radix UI | 1.x | Accessible component primitives |
| | TanStack Query | 5.83 | Server state management |
| | Recharts | 2.15 | Charts & data visualization |
| | Framer Motion | 12.6 | Animations |
| | Lucide React | 0.484 | Icons |
| | Zod | 3.25 | Schema validation |
| **Backend** | Node.js | 20+ | Runtime |
| | Express | 4.21 | HTTP framework |
| | Prisma | 5.22 | ORM + migrations |
| | Winston | 3.18 | Structured logging |
| | Helmet | 8.0 | Security headers |
| | Bcrypt | 2.4 | Password hashing |
| | JWT | 9.0 | Token authentication |
| | Nodemailer | 6.9 | Email sending |
| | node-cron | 3.0 | Scheduled tasks |
| | Multer | 2.1 | File upload |
| | XLSX | 0.18 | Excel parsing/generation |
| | Joi | 17.13 | Input validation |
| | express-rate-limit | 7.5 | API rate limiting |
| **Database** | PostgreSQL | 16 | Primary database |
| **Infrastructure** | Docker | — | Containerization |
| | Nginx | alpine | Reverse proxy + SPA serving |
| | GitHub Actions | — | CI/CD pipeline |
| | Azure Container Apps | — | Cloud deployment |
| | Azure Container Registry | — | Image registry |
