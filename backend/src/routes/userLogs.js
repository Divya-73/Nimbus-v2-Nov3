import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { listUserLogs } from '../controllers/userSpecificLogController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listUserLogs);

export default router;
