import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listOrgs,
  orgFilters,
  orgHierarchy,
  orgById,
  listManagedOrgs,
  createOrg,
  updateOrg,
  deleteOrg,
  orgCounts,
  orgDocById,
} from '../controllers/orgController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listOrgs);
router.post('/', createOrg);
router.get('/filters', orgFilters);
router.get('/hierarchy', orgHierarchy);
router.get('/manage', listManagedOrgs);

router.get('/:orgId/counts', orgCounts);
router.get('/:orgId/doc', orgDocById);
router.put('/:orgId', updateOrg);
router.delete('/:orgId', deleteOrg);
router.get('/:orgId', orgById);

export default router;
