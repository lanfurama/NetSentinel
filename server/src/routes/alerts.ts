import { Router } from 'express';
import {
  getAllAlerts,
  getAlertById,
  createAlert,
  acknowledgeAlert,
  deleteAlert,
} from '../controllers/alertsController.js';

const router = Router();

router.get('/', getAllAlerts);
router.get('/:id', getAlertById);
router.post('/', createAlert);
router.patch('/:id/acknowledge', acknowledgeAlert);
router.delete('/:id', deleteAlert);

export default router;

