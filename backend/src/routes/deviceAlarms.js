import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { deviceAlarms } from '../controllers/deviceAlarmController.js';

const router = express.Router();

router.use(authenticate);
router.get('/:id/alarms', validateDeviceTimeQuery, deviceAlarms);

export default router;
