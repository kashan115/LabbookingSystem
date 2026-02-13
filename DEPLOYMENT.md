# Lab Booking System - Deployment Guide

## 🚀 Professional Containerized Deployment

This is a production-ready containerized Lab Server Booking System with MySQL database, built using:
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: MySQL 8.0
- **Container Orchestration**: Docker Compose

---

## 📋 Prerequisites

- Docker (v20.10+)
- Docker Compose (v2.0+)
- Git

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│   Frontend      │─────▶│    Backend      │─────▶│    MySQL DB     │
│   (Nginx)       │      │   (Express)     │      │                 │
│   Port: 80      │      │   Port: 3000    │      │   Port: 3306    │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## ⚡ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/kkkashan/lab-reservation-syst.git
cd lab-reservation-syst
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your configurations
```

### 3. Build and Start All Containers
```bash
docker-compose up -d --build
```

### 4. Access the Application
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/health

### 5. Default Admin Credentials
- **Email**: admin@lab-booking.com
- **Password**: admin123
*(Change this immediately after first login)*

---

## 🔧 Configuration

### Environment Variables

Edit `.env` file to configure:

```env
# Database
DB_ROOT_PASSWORD=your-root-password
DB_NAME=lab_booking
DB_USER=labuser
DB_PASSWORD=your-secure-password
DB_PORT=3306

# Backend
BACKEND_PORT=3000
NODE_ENV=production

# Frontend
FRONTEND_PORT=80
```

---

## 🐳 Docker Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

### Rebuild Services
```bash
docker-compose up -d --build
```

### Remove Everything (including volumes)
```bash
docker-compose down -v
```

---

## 🗄️ Database Management

### Access MySQL Container
```bash
docker exec -it lab-booking-db mysql -u labuser -p
```

### Run Prisma Migrations
```bash
cd backend
docker-compose exec backend npx prisma migrate deploy
```

### Generate Prisma Client
```bash
cd backend
docker-compose exec backend npx prisma generate
```

### View Database with Prisma Studio
```bash
cd backend
npm install
npx prisma studio
```

---

## 📊 Monitoring & Health Checks

### Check Service Health
```bash
# Backend health
curl http://localhost:3000/health

# Frontend health  
curl http://localhost:80/health

# Database health
docker-compose ps
```

### Container Stats
```bash
docker stats lab-booking-frontend lab-booking-backend lab-booking-db
```

---

## 🔐 Security Considerations

1. **Change Default Passwords**: Update all default passwords in `.env`
2. **SSL/TLS**: Use a reverse proxy (nginx, Traefik) for HTTPS in production
3. **Firewall**: Only expose necessary ports
4. **Database**: Never expose database port (3306) publicly
5. **Secrets**: Use Docker secrets or environment secret management
6. **Updates**: Keep Docker images updated regularly

---

## 🚀 Production Deployment

### Using Docker Swarm
```bash
docker stack deploy -c docker-compose.yml lab-booking
```

### Using Kubernetes
Convert Docker Compose to Kubernetes manifests:
```bash
kompose convert -f docker-compose.yml
kubectl apply -f .
```

### Cloud Deployment Options
- **AWS**: ECS, EKS, or EC2 with Docker
- **Azure**: Container Instances, AKS
- **GCP**: Cloud Run, GKE
- **DigitalOcean**: App Platform, Kubernetes

---

## 🛠️ Development Setup

### Run Backend Locally
```bash
cd backend
npm install
npm run dev
```

### Run Frontend Locally
```bash
npm install
npm run dev
```

---

## 📝 API Endpoints

### Users
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/:id` - Get user details

### Servers
- `GET /api/servers` - List all servers
- `GET /api/servers/:id` - Get server details
- `POST /api/servers` - Create server (Admin)
- `PUT /api/servers/:id` - Update server (Admin)
- `DELETE /api/servers/:id` - Delete server (Admin)

### Bookings
- `GET /api/bookings` - List all bookings
- `GET /api/bookings/user/:userId` - Get user bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id/extend` - Extend booking
- `PUT /api/bookings/:id/cancel` - Cancel booking

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check if database is ready
docker-compose logs database

# Restart database
docker-compose restart database
```

### Backend Not Starting
```bash
# Check backend logs
docker-compose logs backend

# Ensure database migrations ran
docker-compose exec backend npx prisma migrate status
```

### Frontend Not Loading
```bash
# Check frontend logs
docker-compose logs frontend

# Verify backend is accessible
curl http://localhost:3000/health
```

---

## 📦 Backup & Restore

### Backup Database
```bash
docker exec lab-booking-db mysqldump -u labuser -p lab_booking > backup.sql
```

### Restore Database
```bash
docker exec -i lab-booking-db mysql -u labuser -p lab_booking < backup.sql
```

---

## 🎯 Performance Optimization

1. **Frontend**: Static files cached with nginx
2. **Backend**: Connection pooling, rate limiting enabled
3. **Database**: Indexed queries, optimized schema
4. **Docker**: Multi-stage builds for smaller images

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [React Documentation](https://react.dev/)

---

## 🤝 Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review configuration in `.env`
3. Verify Docker and Docker Compose versions
4. Check container health: `docker-compose ps`

---

## 📄 License

MIT License - See LICENSE file for details
