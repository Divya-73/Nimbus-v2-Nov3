import express from 'express';
import { getDeviceDetailsByIpController } from '../controllers/deviceIpLookupController.js';

const router = express.Router();

router.get('/details', getDeviceDetailsByIpController);

export default router;