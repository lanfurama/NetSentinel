import { Router } from 'express';
import {
  getConversations,
  getConversationById,
  createConversation,
  addMessage,
  deleteConversation,
} from '../controllers/chatController.js';

const router = Router();

router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversationById);
router.post('/conversations', createConversation);
router.post('/conversations/:conversationId/messages', addMessage);
router.delete('/conversations/:id', deleteConversation);

export default router;


