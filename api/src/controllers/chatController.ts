import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';

export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      const error: ApiError = new Error('User ID is required');
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `SELECT id, user_id, title, created_at, updated_at 
       FROM chat_conversations 
       WHERE user_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 50`,
      [userId]
    );

    const conversations = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      success: true,
      data: conversations,
      count: conversations.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Get conversation
    const convResult = await pool.query(
      'SELECT * FROM chat_conversations WHERE id = $1',
      [id]
    );

    if (convResult.rows.length === 0) {
      const error: ApiError = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT id, role, content, created_at 
       FROM chat_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    const conversation = convResult.rows[0];
    const messages = messagesResult.rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: {
        id: conversation.id,
        userId: conversation.user_id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, title } = req.body;

    if (!userId) {
      const error: ApiError = new Error('User ID is required');
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `INSERT INTO chat_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, title || 'New Conversation']
    );

    const conversation = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: conversation.id,
        userId: conversation.user_id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId } = req.params;
    const { role, content } = req.body;

    if (!conversationId || !role || !content) {
      const error: ApiError = new Error('Conversation ID, role, and content are required');
      error.statusCode = 400;
      throw error;
    }

    if (role !== 'user' && role !== 'model') {
      const error: ApiError = new Error('Role must be either "user" or "model"');
      error.statusCode = 400;
      throw error;
    }

    // Verify conversation exists
    const convCheck = await pool.query(
      'SELECT id FROM chat_conversations WHERE id = $1',
      [conversationId]
    );

    if (convCheck.rows.length === 0) {
      const error: ApiError = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    // Insert message
    const result = await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversationId, role, content]
    );

    // Update conversation updated_at
    await pool.query(
      'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );

    const message = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        conversationId: message.conversation_id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM chat_conversations WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};


