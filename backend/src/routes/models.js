import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listModels,
  modelFilters,
  modelByName,
} from '../controllers/modelController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listModels);
router.get('/filters', modelFilters);
router.get('/:model', modelByName);

export default router;
