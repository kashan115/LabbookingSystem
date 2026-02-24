import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import prisma from './config/database';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import serverRoutes from './routes/serverRoutes';
import bookingRoutes from './routes/bookingRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import { startScheduler } from './services/scheduler';
import { JWT_MIN_LENGTH, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, REQUEST_BODY_LIMIT } from './config/constants';

dotenv.config();

// Validate required environment variables at startup
function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < JWT_MIN_LENGTH) {
    logger.error(`JWT_SECRET must be at least ${JWT_MIN_LENGTH} characters long`);
    process.exit(1);
  }

  logger.info('Environment variables validated successfully');
}

validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Azure's reverse proxy
app.set('trust proxy', 1);

// Security
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = (process.env.FRONTEND_URL || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
}));

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// Health / readiness endpoints (Azure App Service probes)
app.get('/health', (_req, res) => res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() }));
app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not ready', database: 'disconnected' });
  }
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use('*', (_req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const start = async () => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected');
    startScheduler();
    app.listen(PORT, () => {
      logger.info(`API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
};

start();
