import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listLivePerformance,
  performanceFilters,
} from '../controllers/performanceController.js';
import {
  validateTemplateProvisionPreview,
  validateTemplateProvisionRun,
} from '../middleware/templateProvisionValidation.js';
import {
  previewPerformanceTemplateProvision,
  runPerformanceTemplateProvision,
} from '../controllers/templateProvisionController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listLivePerformance);
router.get('/filters', performanceFilters);
router.post(
  '/template-provision/preview',
  validateTemplateProvisionPreview,
  previewPerformanceTemplateProvision,
);
router.post(
  '/template-provision',
  validateTemplateProvisionRun,
  runPerformanceTemplateProvision,
);

export default router;
