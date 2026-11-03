import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { validateInterfaceHealthQuery } from '../middleware/interfaceHealthValidation.js';
import { deviceInterfaceHealth } from '../controllers/interfaceHealthController.js';

const router = express.Router();

router.use(authenticate);

router.get(
  '/:id/interface-health',
  validateDeviceTimeQuery,
  validateInterfaceHealthQuery,
  deviceInterfaceHealth,
);

export default router;
