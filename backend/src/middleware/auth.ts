import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'No authentication token provided');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError(500, 'JWT_SECRET not configured');

    // Verify JWT
    const decoded = jwt.verify(token, secret) as { userId: string };

    // Check session still exists in DB (allows server-side logout)
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true, isAdmin: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { token } });
      throw new AppError(401, 'Session expired or revoked. Please log in again.');
    }

    req.user = session.user;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, 'Invalid or expired token'));
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return next(new AppError(403, 'Admin access required'));
  }
  next();
};
