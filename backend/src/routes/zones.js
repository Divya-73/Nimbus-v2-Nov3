import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listZones,
  zoneFilters,
  zoneByName,
} from '../controllers/zoneController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listZones);
router.get('/filters', zoneFilters);
router.get('/:zone', zoneByName);

export default router;
