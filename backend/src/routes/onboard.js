import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  assignOnboard,
  listOnboardDevices,
  onboardDeviceById,
  removeOnboardDevice,
} from '../controllers/onboardController.js';

const router = express.Router();

router.use(authenticate);
router.get('/', listOnboardDevices);
router.post('/assign', assignOnboard);
router.get('/:id', onboardDeviceById);
router.delete('/:id', removeOnboardDevice);

export default router;
