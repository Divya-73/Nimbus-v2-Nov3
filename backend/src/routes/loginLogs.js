import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { listLogs } from '../controllers/loginLogController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listLogs);

export default router;
