import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireAdmin, bookingController.getAllBookings);
router.get('/user/:userId', authenticate, bookingController.getBookingsByUser);
router.post('/', authenticate, bookingController.createBooking);
router.put('/:id/extend', authenticate, bookingController.extendBooking);
router.put('/:id/cancel', authenticate, bookingController.cancelBooking);

export default router;
