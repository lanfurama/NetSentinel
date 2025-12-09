import { Router } from 'express';
import { login, kioskLogin, verifyToken } from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/kiosk', kioskLogin);
router.post('/verify', verifyToken);

export default router;


