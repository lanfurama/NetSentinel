import { Router } from 'express';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  testSnmpConnection,
} from '../controllers/devicesController.js';

const router = Router();

router.get('/', getAllDevices);
router.get('/:id', getDeviceById);
router.post('/', createDevice);
router.post('/test-connection', testSnmpConnection);
router.put('/:id', updateDevice);
router.patch('/:id', updateDevice);
router.delete('/:id', deleteDevice);

export default router;

