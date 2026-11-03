import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { validateDataUsageQuery } from '../middleware/dataUsageValidation.js';
import {
  deviceDataUsage,
  deviceIpDataUsage,
} from '../controllers/dataUsageController.js';

const router = express.Router();

router.use(authenticate);

router.get(
  '/:id/data-usage',
  validateDeviceTimeQuery,
  validateDataUsageQuery,
  deviceDataUsage,
);
router.get('/:id/ip-data-usage', validateDeviceTimeQuery, deviceIpDataUsage);

export default router;
