import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { noCache } from '../middleware/cacheHeaders';

const router = Router();

// Bookings are dynamic and personal - should not be cached
router.get('/', authenticate, requireAdmin, noCache, bookingController.getAllBookings);
router.get('/user/:userId', authenticate, noCache, bookingController.getBookingsByUser);
router.post('/', authenticate, bookingController.createBooking);
router.put('/:id/extend', authenticate, bookingController.extendBooking);
router.put('/:id/cancel', authenticate, bookingController.cancelBooking);

export default router;
