import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  deviceInterfaceMap,
  deviceOnboardConfig,
  saveDeviceInterfaceMap,
  saveDeviceOnboardConfig,
} from '../controllers/deviceInterfaceMapController.js';

const router = express.Router();

router.use(authenticate);
router.get('/:id/interface-map', deviceInterfaceMap);
router.put('/:id/interface-map', saveDeviceInterfaceMap);
router.get('/:id/onboard-config', deviceOnboardConfig);
router.put('/:id/onboard-config', saveDeviceOnboardConfig);

export default router;
