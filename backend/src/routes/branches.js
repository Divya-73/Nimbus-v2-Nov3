import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listBranches,
  branchFilters,
  branchById,
  listManagedBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  branchCounts,
  branchDocById,
} from '../controllers/branchController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listBranches);
router.post('/', createBranch);
router.get('/filters', branchFilters);
router.get('/manage', listManagedBranches);

router.get('/:id/counts', branchCounts);
router.get('/:id/doc', branchDocById);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);
router.get('/:id', branchById);

export default router;
