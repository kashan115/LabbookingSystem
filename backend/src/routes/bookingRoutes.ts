import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';

const router = Router();

router.get('/', bookingController.getAllBookings);
router.get('/user/:userId', bookingController.getBookingsByUser);
router.post('/', bookingController.createBooking);
router.put('/:id/extend', bookingController.extendBooking);
router.put('/:id/cancel', bookingController.cancelBooking);

export default router;
