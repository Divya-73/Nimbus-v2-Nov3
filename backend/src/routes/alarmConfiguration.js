import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  createAlarmConfiguration,
  deleteAlarmConfiguration,
  getAlarmConfiguration,
  listAlarmConfiguration,
  listAlarmConfigurationDeviceIds,
  listAlarmConfigurationDevices,
  updateAlarmConfiguration,
} from '../controllers/alarmConfigurationController.js';

const router = express.Router();

router.use(authenticate);

router.get('/devices/ids', listAlarmConfigurationDeviceIds);
router.get('/devices', listAlarmConfigurationDevices);
router.get('/', listAlarmConfiguration);
router.post('/', createAlarmConfiguration);
router.get('/:id', getAlarmConfiguration);
router.put('/:id', updateAlarmConfiguration);
router.delete('/:id', deleteAlarmConfiguration);

export default router;
