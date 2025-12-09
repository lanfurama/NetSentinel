import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      const error: ApiError = new Error('Username and password are required');
      error.statusCode = 400;
      throw error;
    }

    // Query user from database
    const result = await pool.query(
      'SELECT username, full_name, password, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    const user = result.rows[0];

    // Compare password (plain text for demo - in production use bcrypt)
    if (user.password !== password) {
      const error: ApiError = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Return user data (without password)
    const userData = {
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    };

    res.json({
      success: true,
      data: userData,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

export const kioskLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      const error: ApiError = new Error('PIN is required');
      error.statusCode = 400;
      throw error;
    }

    // Check if pin matches any kiosk user password
    const result = await pool.query(
      'SELECT username, full_name, role FROM users WHERE role = $1 AND password = $2',
      ['kiosk', pin]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Invalid PIN code');
      error.statusCode = 401;
      throw error;
    }

    const user = result.rows[0];
    const userData = {
      username: user.username || 'kiosk_display',
      fullName: user.full_name || 'Live Display',
      role: 'kiosk' as const,
    };

    res.json({
      success: true,
      data: userData,
      message: 'Kiosk mode activated',
    });
  } catch (error) {
    next(error);
  }
};

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = req.body;

    if (!username) {
      const error: ApiError = new Error('Username is required');
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      'SELECT username, full_name, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const user = result.rows[0];
    const userData = {
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    };

    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    next(error);
  }
};


