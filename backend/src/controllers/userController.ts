import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { BCRYPT_ROUNDS, TOKEN_EXPIRY_DAYS, PASSWORD_REGEX, PASSWORD_REQUIREMENTS } from '../config/constants';

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, isAdmin } = req.body;
    if (!name || !email || !password) throw new AppError(400, 'name, email and password are required');

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      throw new AppError(400, PASSWORD_REQUIREMENTS);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'User already exists with this email');

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
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
    const id = req.params.id as string;
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

export const getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, isAdmin: true, createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: users });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (id === req.user!.id) throw new AppError(400, 'Cannot delete your own account');
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ status: 'success', message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

export const toggleAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (id === req.user!.id) throw new AppError(400, 'Cannot change your own admin status');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');
    const updated = await prisma.user.update({
      where: { id },
      data: { isAdmin: !user.isAdmin },
      select: { id: true, name: true, email: true, isAdmin: true },
    });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};
