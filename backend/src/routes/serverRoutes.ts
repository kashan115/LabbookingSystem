import { Router } from 'express';
import * as serverController from '../controllers/serverController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, serverController.getAllServers);
router.get('/:id', authenticate, serverController.getServerById);
router.post('/', authenticate, requireAdmin, serverController.createServer);
router.put('/:id', authenticate, requireAdmin, serverController.updateServer);
router.delete('/:id', authenticate, requireAdmin, serverController.deleteServer);

export default router;
