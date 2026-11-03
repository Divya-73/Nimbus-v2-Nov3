import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  validateCreateTemplate,
  validateUpdateTemplate,
  validateMasterTemplate,
  validateTemplateId,
} from '../middleware/templateValidation.js';
import {
  getTemplateOrganizations,
  getTemplateModels,
  getTemplates,
  getTemplateTypes,
  getTemplatesByOrg,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createMasterTemplate,
} from '../controllers/templateController.js';

const router = express.Router();

router.use(authenticate);

router.get('/organizations', getTemplateOrganizations);
router.get('/models', getTemplateModels);
router.get('/types', getTemplateTypes);
router.get('/org/:orgId/model/:model', getTemplatesByOrg);
router.post('/master', validateMasterTemplate, createMasterTemplate);
router.get('/:id', validateTemplateId, getTemplateById);
router.put('/:id', validateTemplateId, validateUpdateTemplate, updateTemplate);
router.delete('/:id', validateTemplateId, deleteTemplate);
router.get('/', getTemplates);
router.post('/', validateCreateTemplate, createTemplate);

export default router;
