import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { sanitizeInput } from '../utils/sanitizer.js';
import { validationError } from '../utils/response.js';
import { removeAssignedDevice } from '../controllers/deviceDeleteController.js';

const router = express.Router();

router.use(authenticate);

router.delete('/:id', (req, res, next) => {
  const id = sanitizeInput(req.params?.id);
  if (!id) {
    return validationError(res, [{ field: 'id', message: 'id is required' }]);
  }
  req.params.id = id;
  return next();
}, removeAssignedDevice);

export default router;
