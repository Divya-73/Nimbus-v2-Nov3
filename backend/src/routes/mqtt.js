import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  validateCreateMqttTask,
  validateRunMqttCommand,
  validateMqttReqId,
  validateMqttTaskName,
} from '../middleware/mqttValidation.js';
import {
  createMqttTask,
  runMqttCommand,
  listMqttCommands,
  getMqttTaskByName,
  getMqttTaskStatus,
  getMqttTaskOutput,
} from '../controllers/mqttController.js';

const router = express.Router();

router.use(authenticate);

router.get('/commands', listMqttCommands);
router.post('/task', validateCreateMqttTask, createMqttTask);
router.post('/run', validateRunMqttCommand, runMqttCommand);
router.get('/task', validateMqttTaskName, getMqttTaskByName);
router.get('/tasklog/:reqId', validateMqttReqId, getMqttTaskStatus);
router.get('/output/:reqId', validateMqttReqId, getMqttTaskOutput);

export default router;
