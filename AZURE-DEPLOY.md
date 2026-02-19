# Azure Deployment Guide — Lab Booking System

Deploy the full stack (React frontend + Node.js API + PostgreSQL) to **Azure Container Apps** using GitHub Actions CI/CD.

---

## What Gets Created in Azure

| Resource | Type | Purpose |
|----------|------|---------|
| `lab-booking-rg` | Resource Group | Container for all resources |
| `labbookingacr` | Container Registry | Stores Docker images |
| `lab-booking-pg` | PostgreSQL Flexible Server | Database |
| `lab-booking-env` | Container Apps Environment | Shared networking for containers |
| `lab-booking-backend` | Container App | Node.js API (internal) |
| `lab-booking-frontend` | Container App | Nginx + React (public URL) |

---

## Prerequisites

Install these tools on your local machine:

```bash
# 1. Azure CLI
# Windows: https://aka.ms/installazurecliwindows
# macOS:   brew install azure-cli
# Linux:   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# 2. Docker Desktop — https://www.docker.com/products/docker-desktop

# 3. Verify
az version
docker version
```

---

## Part 1 — One-Time Azure Setup

Open a terminal and run these commands **in order**. Set your own values for the variables at the top.

### 1.1 — Log in and set variables

```bash
az login

# ── CHANGE THESE VALUES ──────────────────────────────────────────
RG=lab-booking-rg
LOCATION=eastus
ACR_NAME=labbookingacr          # globally unique, lowercase letters/numbers only
DB_SERVER=lab-booking-pg        # globally unique
DB_ADMIN=labadmin
DB_PASS="LabStr0ng@Pass!"       # min 8 chars, upper+lower+number+symbol
DB_NAME=lab_booking
# ─────────────────────────────────────────────────────────────────
```

### 1.2 — Create Resource Group

```bash
az group create --name $RG --location $LOCATION
```

### 1.3 — Create Azure Container Registry

```bash
az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Save these — you need them later
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

echo "ACR_SERVER : $ACR_SERVER"
echo "ACR_USER   : $ACR_USER"
echo "ACR_PASS   : $ACR_PASS"
```

### 1.4 — Create PostgreSQL Flexible Server

```bash
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
  --database-name $DB_NAME \
  --public-access 0.0.0.0

# Build the full connection string
DATABASE_URL="postgresql://${DB_ADMIN}:${DB_PASS}@${DB_SERVER}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require"
echo "DATABASE_URL: $DATABASE_URL"
```

> ⏳ This takes ~5 minutes.

### 1.5 — Create Container Apps Environment

```bash
az containerapp env create \
  --name lab-booking-env \
  --resource-group $RG \
  --location $LOCATION
```

### 1.6 — Build and Push Docker Images

```bash
# Log in to ACR
docker login $ACR_SERVER -u $ACR_USER -p "$ACR_PASS"

# Clone the repo if you haven't already
git clone https://github.com/kkkashan/lab-reservation-syst
cd lab-reservation-syst

# Build & push backend
docker build -t $ACR_SERVER/lab-booking-backend:latest ./backend
docker push $ACR_SERVER/lab-booking-backend:latest

# Build & push frontend
docker build -t $ACR_SERVER/lab-booking-frontend:latest .
docker push $ACR_SERVER/lab-booking-frontend:latest
```

### 1.7 — Deploy Backend Container App

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 48)
echo "JWT_SECRET: $JWT_SECRET"   # save this!

az containerapp create \
  --name lab-booking-backend \
  --resource-group $RG \
  --environment lab-booking-env \
  --image $ACR_SERVER/lab-booking-backend:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password "$ACR_PASS" \
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

# Get internal hostname
BACKEND_FQDN=$(az containerapp show \
  --name lab-booking-backend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Backend internal FQDN: $BACKEND_FQDN"
```

### 1.8 — Deploy Frontend Container App

```bash
az containerapp create \
  --name lab-booking-frontend \
  --resource-group $RG \
  --environment lab-booking-env \
  --image $ACR_SERVER/lab-booking-frontend:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password "$ACR_PASS" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

# Get the public URL
FRONTEND_URL=$(az containerapp show \
  --name lab-booking-frontend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "Your app is live at: https://$FRONTEND_URL"
```

### 1.9 — Update Backend CORS with Frontend URL

```bash
az containerapp update \
  --name lab-booking-backend \
  --resource-group $RG \
  --set-env-vars FRONTEND_URL="https://$FRONTEND_URL"
```

---

## Part 2 — GitHub Actions CI/CD (auto-deploy on push)

After this setup, every push to `main` will automatically build and deploy both containers.

### 2.1 — Create Azure Service Principal for GitHub

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name lab-booking-github-sp \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG \
  --sdk-auth
```

Copy the **entire JSON output** — you need it in the next step.

### 2.2 — Add GitHub Repository Secrets

Go to your repository on GitHub:  
**Settings → Secrets and variables → Actions → New repository secret**

Add these 5 secrets:

| Secret Name | Value |
|-------------|-------|
| `ACR_REGISTRY` | e.g. `labbookingacr.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RG` | `lab-booking-rg` |
| `AZURE_CREDENTIALS` | The full JSON from step 2.1 |

### 2.3 — Trigger First Deployment

```bash
# Make any small change and push, OR use workflow_dispatch:
# GitHub → Actions → "Build & Deploy to Azure" → Run workflow
git commit --allow-empty -m "ci: trigger first Azure deployment"
git push origin main
```

Watch the deployment at: **GitHub → Actions tab**

---

## Part 3 — Verify & Test

```bash
# Check backend health
curl https://YOUR-BACKEND-FQDN/health

# Check backend readiness (DB connection)
curl https://YOUR-BACKEND-FQDN/ready

# View live backend logs
az containerapp logs show \
  --name lab-booking-backend \
  --resource-group lab-booking-rg \
  --follow

# View live frontend logs
az containerapp logs show \
  --name lab-booking-frontend \
  --resource-group lab-booking-rg \
  --follow
```

**Default admin login:**
- URL: `https://<your-frontend-fqdn>`
- Email: `admin@lab-booking.com`
- Password: `password`

> ⚠️  Change the admin password immediately after first login.

---

## Part 4 — Useful Management Commands

```bash
# List all container apps
az containerapp list --resource-group lab-booking-rg -o table

# Restart backend (e.g. after env var changes)
az containerapp revision restart \
  --name lab-booking-backend \
  --resource-group lab-booking-rg

# Update an environment variable
az containerapp update \
  --name lab-booking-backend \
  --resource-group lab-booking-rg \
  --set-env-vars LOG_LEVEL=debug

# Scale backend to zero when not in use (saves cost)
az containerapp update \
  --name lab-booking-backend \
  --resource-group lab-booking-rg \
  --min-replicas 0

# Tear down everything (DELETES ALL RESOURCES)
az group delete --name lab-booking-rg --yes --no-wait
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Frontend shows blank page / 502 | Check backend logs: `az containerapp logs show --name lab-booking-backend -g lab-booking-rg` |
| Login fails with 401 | Verify `JWT_SECRET` env var is set on backend container app |
| DB connection error | Confirm `DATABASE_URL` includes `?sslmode=require` and PostgreSQL firewall allows Azure services |
| GitHub Action fails at deploy step | Check `AZURE_CREDENTIALS` secret is valid — re-run `az ad sp create-for-rbac` |
| Images not found in ACR | Re-run docker build & push steps, confirm `ACR_REGISTRY` secret matches ACR login server |
