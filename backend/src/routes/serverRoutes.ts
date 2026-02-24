import { Router } from 'express';
import * as serverController from '../controllers/serverController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { cacheControl } from '../middleware/cacheHeaders';

const router = Router();

// Cache server list for 30 seconds (servers don't change frequently)
router.get('/', authenticate, cacheControl(30), serverController.getAllServers);
router.get('/:id', authenticate, cacheControl(30), serverController.getServerById);
router.post('/', authenticate, requireAdmin, serverController.createServer);
router.put('/:id', authenticate, requireAdmin, serverController.updateServer);
router.delete('/:id', authenticate, requireAdmin, serverController.deleteServer);

export default router;
