import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const TOKEN_EXPIRY_DAYS = 7;

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, isAdmin } = req.body;
    if (!name || !email || !password) throw new AppError(400, 'name, email and password are required');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'User already exists with this email');

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, isAdmin: isAdmin || false },
      select: { id: true, name: true, email: true, isAdmin: true, createdAt: true },
    });

    res.status(201).json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError(400, 'Email and password are required');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError(401, 'Invalid email or password');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError(500, 'JWT_SECRET not configured');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: `${TOKEN_EXPIRY_DAYS}d` });

    // Persist session in PostgreSQL
    await prisma.session.create({
      data: { userId: user.id, token, expiresAt },
    });

    res.json({
      status: 'success',
      data: {
        token,
        expiresAt,
        user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
    res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, isAdmin: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, isAdmin: true,
        bookings: { include: { server: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
};
