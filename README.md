# LabOps Sentinel — Lab Server Booking System

A production-grade executive dashboard for managing and booking laboratory servers.  
**Stack**: React 19 · TypeScript · Vite 6 · TailwindCSS · Recharts · Node.js 20 · Express · Prisma · PostgreSQL 16 · Docker · Azure

---

## Features

| Page | Description |
|------|-------------|
| **Executive Dashboard** | Donut chart (server status), activity bar chart, architecture filters (ARM64/Intel/AMD + Gen sub-filters), utilization stats, overdue alerts, server grid |
| **Communications** | Send notification form with templates, recipient/subject/message fields · Sent Notifications table with type badges, filtering, and search |
| **Reports & Analytics** | 4 stat cards (bookings, overdue, avg duration, utilization) · Server Status Distribution bar chart · Activity by Action Type chart · Booking History table with filters · Activity Log |
| **Server Management** | Full CRUD · Excel bulk import (xlsx) · Template download |
| **My Bookings** | View/extend/cancel personal bookings |
| **User Management** | Admin-only user list · Promote/demote admin · Delete users |
| **Admin Panel** | Tabs for Servers, Users, Bookings, Email Digest configuration |

**Additional capabilities:**
- JWT authentication with PostgreSQL-backed sessions (7-day expiry)
- Weekly email digest (node-cron, Monday 08:00 UTC) with HTML templates
- Architecture detection from CPU specs (ARM64/Intel/AMD + generation sub-filters)
- Role-based access control (admin vs regular user)
- Docker Compose for local full-stack deployment
- Azure Container Apps deployment with CI/CD (GitHub Actions)

---

## Architecture

```
Browser
  ↓ (port 5173 dev / port 80 prod)
Vite Dev Server / Nginx (frontend)
  ├── /           → serves React SPA
  └── /api/*      → proxy to backend (port 3001)
                            ↓
                   Express API (backend)
                            ↓
                   PostgreSQL 16
```

---

## Local Development — Step by Step

### Prerequisites

- **Node.js 20+** — [install](https://nodejs.org/)
- **PostgreSQL 16** — running locally or in Docker
- **Git**

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/kkkashan/lab-reservation-syst.git
cd lab-reservation-syst
```

---

### Step 2 — Install dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..
```

---

### Step 3 — Set up PostgreSQL

**Option A: Using local PostgreSQL (WSL/Linux/Mac)**

```bash
# Start PostgreSQL service
sudo service postgresql start

# Create database and user
sudo -u postgres psql -c "CREATE USER labuser WITH PASSWORD 'devpassword123';"
sudo -u postgres psql -c "CREATE DATABASE lab_booking OWNER labuser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lab_booking TO labuser;"
```

**Option B: Using Docker**

```bash
docker compose up database -d
```

---

### Step 4 — Configure environment

```bash
# Create backend .env file
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://labuser:devpassword123@localhost:5432/lab_booking"
JWT_SECRET="your-secret-key-change-in-production-minimum-32-chars"
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:5173
EOF
```

**Optional — Email digest (SMTP):**

```bash
# Add these to backend/.env for email functionality
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@company.com
```

---

### Step 5 — Run database migrations

```bash
cd backend
npx prisma migrate deploy
cd ..
```

This creates all required tables: `users`, `servers`, `bookings`, `sessions`.

---

### Step 6 — Build the backend

```bash
cd backend
npx tsc
cd ..
```

---

### Step 7 — Seed the database (first time only)

A default admin user is created automatically on first login attempt if no users exist, or you can register via the app.

**To manually create an admin user:**

```bash
cd backend
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('password', 12);
  await prisma.user.upsert({
    where: { email: 'admin@lab-booking.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@lab-booking.com', password: hash, isAdmin: true }
  });
  console.log('Admin user created: admin@lab-booking.com / password');
  await prisma.\$disconnect();
})();
"
cd ..
```

---

### Step 8 — Start the backend

```bash
cd backend
node dist/server.js &
cd ..
```

You should see:
```
info: PostgreSQL connected
info: API running on port 3001 [development]
```

---

### Step 9 — Start the frontend

```bash
npm run dev -- --host
```

You should see:
```
  VITE v6.0.7  ready in ~500ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://<your-ip>:5173/
```

---

### Step 10 — Open the app

Navigate to **http://localhost:5173** in your browser.

- **Login** with your admin credentials
- **Dashboard** shows the Executive Dashboard with donut chart, activity chart, and server grid
- **Communications** tab lets you send notifications
- **Reports** tab shows analytics, booking history, and activity logs
- **More → Servers** to add/import servers
- **More → My Bookings** to manage your bookings
- **More → Users** (admin only) to manage users
- **More → Admin** (admin only) for advanced settings

---

## Adding Servers

### Manual

Click **More → Servers → Add Server** and fill in the form (name, CPU, memory, storage, GPU, location).

### Excel Bulk Import

1. Click **More → Servers → Download Template** to get the Excel template
2. Fill in the template with your server data (columns: name, cpu_spec, memory_spec, storage_spec, gpu_spec, location, status)
3. Click **Import from Excel** and select your file
4. Preview the data and confirm the import

---

## Navigation Guide

| Tab | Access | Description |
|-----|--------|-------------|
| **Dashboard** | All users | Executive dashboard with charts, filters, stats |
| **Communications** | All users | Send and track notifications |
| **Reports** | All users | Analytics, booking history, activity logs |
| **More → Servers** | All users | Server list with CRUD and Excel import |
| **More → My Bookings** | All users | Personal booking management |
| **More → Users** | Admin only | User management (promote/delete) |
| **More → Admin** | Admin only | Advanced admin panel with email settings |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT token) |
| POST | `/api/auth/logout` | Logout (invalidates session) |
| GET | `/api/auth/me` | Get current user info |

### Servers (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List all servers |
| POST | `/api/servers` | Create a server |
| PUT | `/api/servers/:id` | Update a server |
| DELETE | `/api/servers/:id` | Delete a server |

### Bookings (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List all bookings |
| POST | `/api/bookings` | Create a booking |
| PUT | `/api/bookings/:id/extend` | Extend a booking |
| PUT | `/api/bookings/:id/cancel` | Cancel a booking |

### Admin (requires admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| DELETE | `/api/admin/users/:id` | Delete a user |
| PUT | `/api/admin/users/:id/toggle-admin` | Toggle admin role |
| GET | `/api/admin/email-status` | Check email configuration |
| POST | `/api/admin/send-weekly-digest` | Trigger weekly digest manually |
| POST | `/api/admin/send-test-email` | Send a test email |

---

## Docker Compose (Production-like Local)

### Prerequisites
- Docker Desktop 4.x+
- Docker Compose v2

```bash
# 1. Create .env from template
cp .env.example .env
# Edit .env — change DB_PASSWORD, JWT_SECRET!

# 2. Start all services (database + backend + frontend)
docker compose up --build -d

# 3. View logs
docker compose logs -f

# 4. Open the app
open http://localhost
```

---

## Deploy on Azure — Step by Step

### Prerequisites
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- Docker
- An Azure subscription

---

### Step 1 — Log in & create resource group

```bash
az login

RG=lab-booking-rg
LOCATION=eastus
ACR_NAME=labbookingacr      # globally unique, lowercase, no hyphens

az group create --name $RG --location $LOCATION
```

---

### Step 2 — Create Azure Container Registry (ACR)

```bash
az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

echo "Registry: $ACR_SERVER"
```

---

### Step 3 — Create Azure Database for PostgreSQL

```bash
DB_SERVER=lab-booking-pg        # globally unique
DB_ADMIN=labadmin
DB_PASS=StrongP@ssw0rd123!

az postgres flexible-server create \
  --resource-group $RG \
  --name $DB_SERVER \
  --location $LOCATION \
  --admin-user $DB_ADMIN \
  --admin-password "$DB_PASS" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --database-name lab_booking \
  --public-access 0.0.0.0

DATABASE_URL="postgresql://${DB_ADMIN}:${DB_PASS}@${DB_SERVER}.postgres.database.azure.com:5432/lab_booking?sslmode=require"
echo "DATABASE_URL: $DATABASE_URL"
```

---

### Step 4 — Build and push Docker images

```bash
docker login $ACR_SERVER -u $ACR_USER -p $ACR_PASS

docker build -t $ACR_SERVER/lab-booking-backend:latest ./backend
docker push $ACR_SERVER/lab-booking-backend:latest

docker build -t $ACR_SERVER/lab-booking-frontend:latest .
docker push $ACR_SERVER/lab-booking-frontend:latest
```

---

### Step 5 — Create Container Apps Environment

```bash
az containerapp env create \
  --name lab-booking-env \
  --resource-group $RG \
  --location $LOCATION
```

---

### Step 6 — Deploy backend Container App

```bash
JWT_SECRET=$(openssl rand -base64 48)

az containerapp create \
  --name lab-booking-backend \
  --resource-group $RG \
  --environment lab-booking-env \
  --image $ACR_SERVER/lab-booking-backend:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --target-port 3001 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL="$DATABASE_URL" \
    JWT_SECRET="$JWT_SECRET" \
    LOG_LEVEL=info

BACKEND_FQDN=$(az containerapp show \
  --name lab-booking-backend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Backend FQDN: $BACKEND_FQDN"
```

---

### Step 7 — Deploy frontend Container App

```bash
az containerapp create \
  --name lab-booking-frontend \
  --resource-group $RG \
  --environment lab-booking-env \
  --image $ACR_SERVER/lab-booking-frontend:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

az containerapp show \
  --name lab-booking-frontend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

---

### Step 8 — Update CORS on backend

```bash
FRONTEND_FQDN=$(az containerapp show \
  --name lab-booking-frontend --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)

az containerapp update \
  --name lab-booking-backend \
  --resource-group $RG \
  --set-env-vars FRONTEND_URL="https://$FRONTEND_FQDN"
```

---

### Step 9 — Set up CI/CD with GitHub Actions

Add these **GitHub repository secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `ACR_REGISTRY` | `labbookingacr.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RG` | `lab-booking-rg` |
| `AZURE_CREDENTIALS` | Output of `az ad sp create-for-rbac` (see below) |

```bash
az ad sp create-for-rbac \
  --name lab-booking-github-sp \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RG \
  --sdk-auth
# Copy the full JSON output → paste as AZURE_CREDENTIALS secret
```

After setting secrets, every push to `main` automatically builds, pushes, and deploys both containers.

---

## Environment Variables Reference

### Root `.env` (Docker Compose)
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_NAME` | `lab_booking` | PostgreSQL database name |
| `DB_USER` | `labuser` | PostgreSQL user |
| `DB_PASSWORD` | _(required)_ | PostgreSQL password |
| `DB_PORT` | `5432` | Host port for DB |
| `JWT_SECRET` | _(required)_ | Min 32-char random string |
| `BACKEND_PORT` | `3001` | Host port for API |
| `FRONTEND_PORT` | `80` | Host port for UI |

### Backend `.env`
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string |
| `JWT_SECRET` | Token signing secret |
| `FRONTEND_URL` | Allowed CORS origin(s) |
| `PORT` | Backend listen port (default `3001`) |
| `NODE_ENV` | `production` or `development` |
| `LOG_LEVEL` | `info`, `debug`, `warn`, `error` |
| `SMTP_HOST` | SMTP server hostname (optional) |
| `SMTP_PORT` | SMTP port, typically `587` (optional) |
| `SMTP_USER` | SMTP username (optional) |
| `SMTP_PASS` | SMTP password (optional) |
| `EMAIL_FROM` | Sender email address (optional) |

---

## Security Checklist (before production)

- [ ] Change default admin password (`admin@lab-booking.com` / `password`)
- [ ] Set `JWT_SECRET` to a random 48-byte base64 string
- [ ] Set `DB_PASSWORD` to a strong password
- [ ] Restrict PostgreSQL public access to backend IP only
- [ ] Enable HTTPS (Azure Container Apps provides TLS by default)
- [ ] Set `NODE_ENV=production` on all containers
- [ ] Review `FRONTEND_URL` CORS — do not use `*`
- [ ] Enable Azure Defender for Containers

---

## Useful Commands

```bash
# Restart backend locally
kill $(lsof -ti:3001) 2>/dev/null
cd backend && npx tsc && node dist/server.js &

# Restart frontend locally
kill $(lsof -ti:5173) 2>/dev/null
npm run dev -- --host &

# Check service status
lsof -ti:3001 && echo "Backend: UP" || echo "Backend: DOWN"
lsof -ti:5173 && echo "Frontend: UP" || echo "Frontend: DOWN"

# Run Prisma Studio (database GUI)
cd backend && npx prisma studio

# Reset database
cd backend && npx prisma migrate reset

# View Azure logs
az containerapp logs show \
  --name lab-booking-backend \
  --resource-group lab-booking-rg \
  --follow

# Tear down Azure resources
az group delete --name lab-booking-rg --yes --no-wait
```

---

## Project Structure

```
lab-reservation-syst/
├── src/                              # React frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── Navigation.tsx            # LabOps Sentinel header with tabs + More dropdown
│   │   ├── Dashboard.tsx             # Executive Dashboard (donut chart, activity chart, filters)
│   │   ├── Communications.tsx        # Send notification form + sent notifications table
│   │   ├── Reports.tsx               # Reports & Analytics (charts, booking history, activity log)
│   │   ├── ServerList.tsx            # Server management + Excel bulk import
│   │   ├── ServerCard.tsx            # Individual server card display
│   │   ├── MyBookings.tsx            # Personal booking management
│   │   ├── UserManagement.tsx        # Admin user management page
│   │   ├── AdminPanel.tsx            # Admin panel with tabs (Servers/Users/Bookings/Email)
│   │   ├── LoginForm.tsx             # Authentication page
│   │   ├── AddServerDialog.tsx       # Add/edit server dialog
│   │   ├── BookingDialog.tsx         # Create booking dialog
│   │   ├── ServerDetailsDialog.tsx   # Server details view
│   │   └── ui/                       # shadcn/ui component library
│   ├── hooks/
│   │   └── use-booking-data.ts       # TanStack Query hooks (useServers, useBookings, useCurrentUser)
│   ├── lib/
│   │   ├── api.ts                    # Typed fetch client (auth, servers, bookings, users, admin APIs)
│   │   ├── booking-utils.ts          # Utility functions (status, dates, formatting)
│   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   └── utils.ts                  # General utilities (cn)
│   ├── App.tsx                       # Main app with routing (dashboard/communications/reports/...)
│   └── main.tsx                      # Entry point
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── userController.ts     # Auth + user CRUD (login, register, getAllUsers, toggleAdmin)
│   │   │   ├── serverController.ts   # Server CRUD with status support
│   │   │   └── bookingController.ts  # Booking CRUD with conflict checking
│   │   ├── middleware/
│   │   │   └── auth.ts               # JWT authenticate + requireAdmin middleware
│   │   ├── routes/
│   │   │   ├── userRoutes.ts         # /api/auth/* routes
│   │   │   ├── serverRoutes.ts       # /api/servers/* routes
│   │   │   ├── bookingRoutes.ts      # /api/bookings/* routes
│   │   │   └── adminRoutes.ts        # /api/admin/* routes (users, email digest)
│   │   ├── services/
│   │   │   ├── emailService.ts       # Nodemailer HTML digest templates
│   │   │   └── scheduler.ts          # node-cron weekly digest (Monday 08:00 UTC)
│   │   └── server.ts                 # Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma             # Data model (User, Server, Booking, Session)
│   │   └── migrations/               # SQL migration history
│   ├── Dockerfile
│   └── package.json
├── Dockerfile                        # Frontend Nginx production image
├── nginx.conf                        # Nginx config (SPA + API proxy)
├── docker-compose.yml                # Local full-stack with Docker
├── .env.example                      # Environment template
├── vite.config.ts                    # Vite config with API proxy to :3001
├── tailwind.config.js                # TailwindCSS configuration
├── tsconfig.json                     # TypeScript config
├── package.json                      # Frontend dependencies
└── .github/workflows/
    └── azure-deploy.yml              # CI/CD pipeline (build → ACR → Azure Container Apps)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED :5432` | Start PostgreSQL: `sudo service postgresql start` |
| `ECONNREFUSED :3001` | Start backend: `cd backend && node dist/server.js &` |
| Port already in use | Kill process: `kill $(lsof -ti:<port>)` |
| Migration lock mismatch | Check `backend/prisma/migrations/migration_lock.toml` says `provider = "postgresql"` |
| 401 on API calls | Login again — JWT session may have expired (7-day expiry) |
| SMTP not configured warning | Normal if email env vars aren't set — app works without email |
| Excel import fails | Ensure columns match template: name, cpu_spec, memory_spec, storage_spec, gpu_spec, location, status |

---

## License

MIT
