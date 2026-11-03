import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listRegions,
  regionFilters,
  regionByName,
} from '../controllers/regionController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listRegions);
router.get('/filters', regionFilters);
router.get('/:region', regionByName);

export default router;
