import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { deviceLinkHealth } from '../controllers/linkHealthController.js';

const router = express.Router();

router.use(authenticate);

router.get('/:id/link-health', validateDeviceTimeQuery, deviceLinkHealth);

export default router;
