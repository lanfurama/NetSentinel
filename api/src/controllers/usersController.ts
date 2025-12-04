import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.query;
    let query = 'SELECT username, full_name, role, created_at, updated_at FROM users WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (role) {
      query += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const users = result.rows.map((row) => ({
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserByUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = req.params;
    const result = await pool.query(
      'SELECT username, full_name, role, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    const user = {
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, fullName, password, role = 'viewer' } = req.body;

    if (!username || !fullName || !password) {
      const error: ApiError = new Error('Username, full name, and password are required');
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `INSERT INTO users (username, full_name, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING username, full_name, role, created_at, updated_at`,
      [username, fullName, password, role]
    );

    const row = result.rows[0];
    const user = {
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      const apiError: ApiError = new Error('Username already exists');
      apiError.statusCode = 409;
      next(apiError);
    } else {
      next(error);
    }
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = req.params;
    const { fullName, role } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(fullName);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (updates.length === 0) {
      const error: ApiError = new Error('No fields to update');
      error.statusCode = 400;
      throw error;
    }

    values.push(username);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE username = $${paramCount} RETURNING username, full_name, role, created_at, updated_at`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    const user = {
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = req.params;
    const result = await pool.query('DELETE FROM users WHERE username = $1 RETURNING username', [username]);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

