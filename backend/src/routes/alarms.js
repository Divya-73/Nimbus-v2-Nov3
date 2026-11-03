import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { listAlarms, alarmFilters, alarmStats, clearAlarm } from '../controllers/alarmController.js';

const router = express.Router();

router.use(authenticate);

router.get('/filters', alarmFilters);
router.get('/stats', alarmStats);
router.post('/:id/clear', clearAlarm);
router.get('/', listAlarms);

export default router;
