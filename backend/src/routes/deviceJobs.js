import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateDeviceTimeQuery } from '../middleware/deviceHealthValidation.js';
import { deviceJobs } from '../controllers/deviceJobController.js';

const router = express.Router();

router.use(authenticate);
router.get('/:id/jobs', validateDeviceTimeQuery, deviceJobs);

export default router;
