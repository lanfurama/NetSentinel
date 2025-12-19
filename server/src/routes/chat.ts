import { Router } from 'express';
import {
  getMessages,
  addMessage,
  deleteMessage,
  deleteAllMessages,
} from '../controllers/chatController.js';

const router = Router();

router.get('/messages', getMessages);
router.post('/messages', addMessage);
router.delete('/messages/:id', deleteMessage);
router.delete('/messages', deleteAllMessages);

export default router;
