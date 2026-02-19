import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/logout', authenticate, userController.logoutUser);
router.get('/me', authenticate, userController.getMe);
router.get('/', authenticate, requireAdmin, userController.getAllUsers);
router.delete('/:id', authenticate, requireAdmin, userController.deleteUser);
router.patch('/:id/toggle-admin', authenticate, requireAdmin, userController.toggleAdmin);
router.get('/:id', authenticate, userController.getUserById);

export default router;
