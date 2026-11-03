import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceHealthQuery } from '../middleware/deviceHealthValidation.js';
import { deviceHealth } from '../controllers/deviceHealthController.js';

const router = express.Router();

router.use(authenticate);

router.get('/:id/health', validateDeviceHealthQuery, deviceHealth);

export default router;
