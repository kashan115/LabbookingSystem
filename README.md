# Lab Booking System

A production-grade web application for booking laboratory servers.  
**Stack**: React 19 · TypeScript · Vite · Node.js · Express · Prisma · PostgreSQL · Docker · Azure

---

## Architecture

```
Browser
  ↓ (port 80)
Nginx (frontend container)
  ├── /           → serves React SPA
  └── /api/*      → proxy to backend container (port 3001)
                            ↓
                   Express API (backend container)
                            ↓
                   PostgreSQL (Azure Flexible Server / local container)
```

---

## Quick Start — Docker Compose (local)

### Prerequisites
- Docker Desktop 4.x+
- Docker Compose v2

```bash
# 1. Clone the repo
git clone https://github.com/kkkashan/lab-reservation-syst
cd lab-reservation-syst

# 2. Create your .env (never commit this)
cp .env.example .env
# Edit .env — change DB_PASSWORD and JWT_SECRET!

# 3. Start everything (database + backend + frontend)
docker compose up --build -d

# 4. View logs
docker compose logs -f

# 5. Open the app
open http://localhost
```

**Default admin credentials**  
Email: `admin@lab-booking.com`  
Password: `password`  
⚠️ Change these immediately in production.

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally (or `docker compose up database -d`)

```bash
# Install frontend deps
npm install

# Install backend deps
cd backend && npm install && cd ..

# Start PostgreSQL (Docker shortcut)
docker compose up database -d

# Run migrations + seed
cd backend
npx prisma migrate deploy
cd ..

# Start backend (terminal 1)
cd backend && npm run dev

# Start frontend (terminal 2)
npm run dev
# → http://localhost:5173
```

---

## Deploy on Azure — Step-by-Step

### Prerequisites
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- Docker
- An Azure subscription

---

### Step 1 — Log in & create resource group

```bash
az login

# Set your values
RG=lab-booking-rg
LOCATION=eastus
ACR_NAME=labbookingacr      # must be globally unique, lowercase, no hyphens

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

# Get credentials
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

echo "Registry: $ACR_SERVER"
```

---

### Step 3 — Create Azure Database for PostgreSQL (Flexible Server)

```bash
DB_SERVER=lab-booking-pg        # globally unique
DB_ADMIN=labadmin
DB_PASS=StrongP@ssw0rd123!      # must meet Azure complexity rules

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
  --public-access 0.0.0.0    # allow Azure services; restrict further in prod

DATABASE_URL="postgresql://${DB_ADMIN}:${DB_PASS}@${DB_SERVER}.postgres.database.azure.com:5432/lab_booking?sslmode=require"
echo "DATABASE_URL: $DATABASE_URL"
```

---

### Step 4 — Build and push Docker images

```bash
# Log in to ACR
docker login $ACR_SERVER -u $ACR_USER -p $ACR_PASS

# Build and push backend
docker build -t $ACR_SERVER/lab-booking-backend:latest ./backend
docker push $ACR_SERVER/lab-booking-backend:latest

# Build and push frontend
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
FRONTEND_URL=https://lab-booking-frontend.<unique-id>.${LOCATION}.azurecontainerapps.io

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
    FRONTEND_URL="$FRONTEND_URL" \
    LOG_LEVEL=info

# Get the backend's internal FQDN
BACKEND_FQDN=$(az containerapp show \
  --name lab-booking-backend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Backend FQDN: $BACKEND_FQDN"
```

---

### Step 7 — Deploy frontend Container App

The frontend Nginx proxies `/api/` to `http://backend:3001`. In Container Apps the service name resolves via environment DNS — add the backend as a service binding or update the proxy target to the internal FQDN.

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

# Get the public URL
az containerapp show \
  --name lab-booking-frontend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

---

### Step 8 — Update CORS on backend

```bash
az containerapp update \
  --name lab-booking-backend \
  --resource-group $RG \
  --set-env-vars FRONTEND_URL="https://<your-frontend-fqdn>"
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
# Create a service principal for GitHub Actions
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

### Backend container environment
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string |
| `JWT_SECRET` | Same as above |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |
| `PORT` | Backend listen port (default `3001`) |
| `NODE_ENV` | `production` or `development` |
| `LOG_LEVEL` | `info`, `debug`, `warn`, `error` |

---

## Security Checklist (before production)

- [ ] Change default admin password (`admin@lab-booking.com` / `password`)
- [ ] Set `JWT_SECRET` to a random 48-byte base64 string
- [ ] Set `DB_PASSWORD` to a strong password (never `labpassword`)
- [ ] Restrict PostgreSQL public access to backend IP only
- [ ] Enable HTTPS (Azure Container Apps provides TLS by default on external ingress)
- [ ] Set `NODE_ENV=production` on all containers
- [ ] Review `FRONTEND_URL` CORS — do not use `*`
- [ ] Enable Azure Defender for Containers

---

## Useful Commands

```bash
# View real-time backend logs on Azure
az containerapp logs show \
  --name lab-booking-backend \
  --resource-group lab-booking-rg \
  --follow

# Scale backend to zero (cost saving during off-hours)
az containerapp update \
  --name lab-booking-backend \
  --resource-group lab-booking-rg \
  --min-replicas 0

# List all container apps
az containerapp list --resource-group lab-booking-rg -o table

# Tear down everything
az group delete --name lab-booking-rg --yes --no-wait
```

---

## Project Structure

```
lab-reservation-syst/
├── src/                        # React frontend
│   ├── components/             # UI components
│   ├── hooks/use-booking-data.ts  # TanStack Query hooks
│   ├── lib/
│   │   ├── api.ts              # Typed fetch client
│   │   └── types.ts            # Shared types
│   └── main.tsx
├── backend/
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/auth.ts  # JWT + DB session auth
│   │   ├── routes/             # Express routers
│   │   └── server.ts           # App entry point
│   ├── prisma/
│   │   ├── schema.prisma       # Data model (PostgreSQL)
│   │   └── migrations/         # SQL migration history
│   └── Dockerfile
├── Dockerfile                  # Frontend Nginx image
├── nginx.conf                  # Nginx config (SPA + API proxy)
├── docker-compose.yml          # Local full-stack
├── .env.example                # Environment template
└── .github/workflows/
    └── azure-deploy.yml        # CI/CD pipeline
```
