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

dotenv.config();

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
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
}));

app.use(express.json({ limit: '10kb' }));
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
    app.listen(PORT, () => {
      logger.info(`API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
};

start();
