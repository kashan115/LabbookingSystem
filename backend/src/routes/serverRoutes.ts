import { Router } from 'express';
import * as serverController from '../controllers/serverController';

const router = Router();

router.get('/', serverController.getAllServers);
router.get('/:id', serverController.getServerById);
router.post('/', serverController.createServer);
router.put('/:id', serverController.updateServer);
router.delete('/:id', serverController.deleteServer);

export default router;
