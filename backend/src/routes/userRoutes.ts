import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { noCache } from '../middleware/cacheHeaders';

const router = Router();

router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/logout', authenticate, userController.logoutUser);
// User data should not be cached (sensitive/personal)
router.get('/me', authenticate, noCache, userController.getMe);
router.get('/', authenticate, requireAdmin, noCache, userController.getAllUsers);
router.delete('/:id', authenticate, requireAdmin, userController.deleteUser);
router.patch('/:id/toggle-admin', authenticate, requireAdmin, userController.toggleAdmin);
router.get('/:id', authenticate, noCache, userController.getUserById);

export default router;
