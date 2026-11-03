import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  validateCreateGroupConfig,
  validateFirmwareModelQuery,
  validateGroupConfigId,
  validateOrgModelQuery,
  validateUpdateGroupConfig,
} from '../middleware/groupConfigValidation.js';
import {
  createGroupConfig,
  deleteGroupConfig,
  getGroupConfigById,
  getGroupConfigDetail,
  listGroupConfig,
  listGroupConfigDevices,
  listGroupConfigFirmwares,
  listGroupConfigModels,
  listGroupConfigOrganizations,
  listGroupConfigTemplates,
  refreshGroupConfig,
  runGroupConfig,
  updateGroupConfig,
} from '../controllers/groupConfigController.js';

const router = express.Router();

router.use(authenticate);

router.get('/organizations', listGroupConfigOrganizations);
router.get('/models', listGroupConfigModels);
router.get('/templates', validateOrgModelQuery, listGroupConfigTemplates);
router.get('/firmwares', validateFirmwareModelQuery, listGroupConfigFirmwares);
router.get('/devices', validateOrgModelQuery, listGroupConfigDevices);
router.get('/', listGroupConfig);
router.post('/', validateCreateGroupConfig, createGroupConfig);
router.get('/:id/details', validateGroupConfigId, getGroupConfigDetail);
router.post('/:id/run', validateGroupConfigId, runGroupConfig);
router.post('/:id/refresh', validateGroupConfigId, refreshGroupConfig);
router.get('/:id', validateGroupConfigId, getGroupConfigById);
router.put('/:id', validateGroupConfigId, validateUpdateGroupConfig, updateGroupConfig);
router.delete('/:id', validateGroupConfigId, deleteGroupConfig);

export default router;
