import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { deviceById } from '../controllers/deviceController.js';
import { createDeviceGuiSession } from '../controllers/deviceGuiController.js';
import { createDeviceSshSession } from '../controllers/deviceSshController.js';

const router = express.Router();

/** GUI proxy is mounted in App.js BEFORE express.json() so LuCI /ubus POST bodies stay intact. */

router.use(authenticate);

router.post('/:id/gui-session', createDeviceGuiSession);
router.post('/:id/ssh-session', createDeviceSshSession);
router.get('/:id', deviceById);

export default router;
