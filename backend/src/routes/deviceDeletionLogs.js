import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { listDeviceDeletionLogEntries } from '../controllers/deviceDeletionLogController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listDeviceDeletionLogEntries);

export default router;
