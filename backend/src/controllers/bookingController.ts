import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const getAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        server: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: bookings });
  } catch (error) {
    next(error);
  }
};

export const getBookingsByUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        server: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: bookings });
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId, userId, startDate, endDate, purpose } = req.body;

    // Check for overlapping bookings
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        serverId,
        status: { in: ['active', 'pending_renewal'] },
        OR: [
          {
            AND: [
              { startDate: { lte: new Date(startDate) } },
              { endDate: { gte: new Date(startDate) } },
            ],
          },
          {
            AND: [
              { startDate: { lte: new Date(endDate) } },
              { endDate: { gte: new Date(endDate) } },
            ],
          },
          {
            AND: [
              { startDate: { gte: new Date(startDate) } },
              { endDate: { lte: new Date(endDate) } },
            ],
          },
        ],
      },
    });

    if (overlappingBooking) {
      throw new AppError(409, 'Server is already booked for the selected dates');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysBooked = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const booking = await prisma.booking.create({
      data: {
        serverId,
        userId,
        startDate: start,
        endDate: end,
        purpose,
        daysBooked,
        status: 'active',
      },
      include: {
        server: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update server status
    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'booked' },
    });

    res.status(201).json({ status: 'success', data: booking });
  } catch (error) {
    next(error);
  }
};

export const extendBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newEndDate } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    const newEnd = new Date(newEndDate);
    const daysBooked = Math.ceil((newEnd.getTime() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60 * 24));

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        endDate: newEnd,
        daysBooked,
        renewalNotificationSent: false,
        status: 'active',
      },
      include: {
        server: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ status: 'success', data: updatedBooking });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        server: true,
      },
    });

    // Check if there are other active bookings for this server
    const activeBookings = await prisma.booking.count({
      where: {
        serverId: booking.serverId,
        status: { in: ['active', 'pending_renewal'] },
        id: { not: id },
      },
    });

    // Update server status if no more active bookings
    if (activeBookings === 0) {
      await prisma.server.update({
        where: { id: booking.serverId },
        data: { status: 'available' },
      });
    }

    res.json({ status: 'success', data: booking });
  } catch (error) {
    next(error);
  }
};
