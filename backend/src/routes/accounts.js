import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listAccounts,
  accountById,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../controllers/accountController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listAccounts);
router.post('/', createAccount);
router.get('/:id', accountById);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;
