import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/logout', authenticate, userController.logoutUser);
router.get('/me', authenticate, userController.getMe);
router.get('/:id', authenticate, userController.getUserById);

export default router;
