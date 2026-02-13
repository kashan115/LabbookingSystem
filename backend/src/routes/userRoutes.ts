import { Router } from 'express';
import * as userController from '../controllers/userController';

const router = Router();

router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/:id', userController.getUserById);

export default router;
