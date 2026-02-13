# 🧪 Lab Server Booking System

A professional, containerized web application for managing lab server bookings with automated notifications and administrative controls.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)
![Node](https://img.shields.io/badge/node-20.x-green.svg)
![MySQL](https://img.shields.io/badge/mysql-8.0-blue.svg)

---

## ✨ Features

- 🖥️ **Server Management** - Track 20+ lab servers with real-time availability
- 📅 **Smart Booking** - Prevent double-bookings with date conflict detection
- 🔔 **Renewal Notifications** - Automatic alerts for bookings exceeding 15 days
- 👥 **User Management** - Role-based access (Users & Admins)
- 📊 **Dashboard** - Visual overview of all servers and bookings
- 🔒 **Secure Authentication** - Password hashing with bcrypt
- 🐳 **Fully Containerized** - Docker-ready for easy deployment
- 🗄️ **MySQL Database** - Persistent data storage with Prisma ORM

---

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/kkkashan/lab-reservation-syst.git
cd lab-reservation-syst

# 2. Start all services
docker-compose up -d --build

# 3. Access the application
# Frontend: http://localhost:80
# Backend: http://localhost:3000
```

**Default Admin Login:**
- Email: `admin@lab-booking.com`
- Password: `admin123`

---

## 🏗️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (Build Tool)
- TailwindCSS + Radix UI
- React Query (State Management)
- GitHub Spark UI Components

### Backend
- Node.js + Express + TypeScript
- Prisma ORM
- JWT Authentication
- Winston (Logging)
- Express Rate Limiting
- Helmet (Security)

### Database
- MySQL 8.0
- Prisma Migrations

### DevOps
- Docker & Docker Compose
- Multi-stage builds
- Health checks
- Volume persistence

---

## 📁 Project Structure

```
lab-reservation-syst/
├── backend/                 # Backend API
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── routes/         # Express routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── config/         # Configuration files
│   │   └── server.ts       # Express server
│   ├── prisma/             # Database schema & migrations
│   ├── Dockerfile          # Backend container
│   └── package.json
├── src/                     # Frontend source
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities & types
│   └── main.tsx            # Entry point
├── docker-compose.yml      # Orchestration
├── Dockerfile              # Frontend container
├── nginx.conf              # Web server config
└── DEPLOYMENT.md           # Detailed deployment guide
```

---

## 🔧 Development Setup

### Prerequisites
- Node.js 20+
- MySQL 8.0
- Docker (optional)

### Local Development

#### Backend
```bash
cd backend
npm install
cp .env.example .env
# Update DATABASE_URL in .env
npm run dev
```

#### Frontend
```bash
npm install
npm run dev
```

---

## 📖 Documentation

- **[Deployment Guide](DEPLOYMENT.md)** - Comprehensive deployment instructions
- **[API Documentation](#-api-endpoints)** - REST API reference
- **[PRD](PRD.md)** - Product Requirements Document

---

## 🔌 API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login

### Servers
- `GET /api/servers` - List all servers
- `POST /api/servers` - Create server (Admin only)
- `PUT /api/servers/:id` - Update server (Admin only)
- `DELETE /api/servers/:id` - Delete server (Admin only)

### Bookings
- `GET /api/bookings` - List all bookings
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/:id/extend` - Extend booking
- `PUT /api/bookings/:id/cancel` - Cancel booking

---

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Remove all (including data)
docker-compose down -v
```

---

## 🗄️ Database

### Schema
- **Users** - Authentication & authorization
- **Servers** - Lab server inventory
- **Bookings** - Reservation records with relationships

### Migrations
```bash
cd backend
npx prisma migrate dev      # Development
npx prisma migrate deploy   # Production
npx prisma studio          # Visual database editor
```

---

## 🔐 Security Features

- ✅ Password hashing (bcrypt)
- ✅ Rate limiting on API endpoints
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ SQL injection prevention (Prisma)
- ✅ Input validation
- ✅ Environment variable protection

---

## 📊 Monitoring

### Health Checks
- Frontend: `http://localhost:80/health`
- Backend: `http://localhost:3000/health`
- Database: Docker health check enabled

### Logging
- Winston logger with timestamps
- Separate error and info logs
- Container logs via Docker

---

## 🚢 Deployment Options

### Cloud Platforms
- **AWS**: ECS, EKS, Elastic Beanstalk
- **Azure**: Container Instances, AKS
- **GCP**: Cloud Run, GKE
- **DigitalOcean**: App Platform
- **Heroku**: Container Registry

### Self-Hosted
- Docker Swarm
- Kubernetes
- Traditional VPS with Docker

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

---

## 📝 Environment Variables

```env
# Database
DB_NAME=lab_booking
DB_USER=labuser
DB_PASSWORD=your-password
DB_PORT=3306

# Backend
BACKEND_PORT=3000
NODE_ENV=production

# Frontend
FRONTEND_PORT=80
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Author

**Kashan J**
- GitHub: [@kkkashan](https://github.com/kkkashan)

---

## 🙏 Acknowledgments

- Built with [GitHub Spark](https://github.com/githubnext/spark)
- UI Components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Heroicons](https://heroicons.com/)

---

**⭐ If you find this project useful, please give it a star!**
