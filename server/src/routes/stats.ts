import { Router } from 'express';
import { getSystemStats } from '../controllers/statsController.js';

const router = Router();

router.get('/', getSystemStats);

export default router;

