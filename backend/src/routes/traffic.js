import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { deviceTraffic } from '../controllers/trafficController.js';

const router = express.Router();

router.use(authenticate);

router.get('/:id/traffic', validateDeviceTimeQuery, deviceTraffic);

export default router;
