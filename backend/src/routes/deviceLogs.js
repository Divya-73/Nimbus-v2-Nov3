import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { deviceLogs } from '../controllers/deviceLogController.js';

const router = express.Router();

router.use(authenticate);
router.get('/:id/logs', validateDeviceTimeQuery, deviceLogs);

export default router;
