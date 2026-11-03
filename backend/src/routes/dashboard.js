import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  stats,
  getDashboard,
  refreshDashboard,
  getAlarmLogsController,
  getAlarmStatsController,
  getAlarmFilters,
  getDeviceMap,
  getUptimeTrend,
} from '../controllers/dashboardController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getDashboard);
router.get('/stats', stats);
router.get('/refresh', refreshDashboard);

router.get('/alarms', getAlarmLogsController);
router.get('/alarms/stats', getAlarmStatsController);
router.get('/alarms/filters', getAlarmFilters);

router.get('/map', getDeviceMap);
router.get('/uptime', getUptimeTrend);

export default router;
