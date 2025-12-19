import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';

// Get all messages for a user
export const getMessages = async (
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
      `SELECT id, user_id, role, content, created_at 
       FROM chat_messages 
       WHERE user_id = $1 
       ORDER BY created_at ASC 
       LIMIT 100`,
      [userId]
    );

    const messages = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    next(error);
  }
};

// Add a new message
export const addMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role, content } = req.body;

    if (!userId || !role || !content) {
      const error: ApiError = new Error('User ID, role, and content are required');
      error.statusCode = 400;
      throw error;
    }

    if (role !== 'user' && role !== 'model') {
      const error: ApiError = new Error('Role must be either "user" or "model"');
      error.statusCode = 400;
      throw error;
    }

    // Insert message
    const result = await pool.query(
      `INSERT INTO chat_messages (user_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, role, content]
    );

    const message = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        userId: message.user_id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete a message
export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM chat_messages WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Delete all messages for a user
export const deleteAllMessages = async (
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

    await pool.query(
      'DELETE FROM chat_messages WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'All messages deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
