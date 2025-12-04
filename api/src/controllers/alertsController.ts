import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';

export const getAllAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { severity, acknowledged, deviceId } = req.query;
    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (severity) {
      query += ` AND severity = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    if (acknowledged !== undefined) {
      query += ` AND acknowledged = $${paramCount}`;
      params.push(acknowledged === 'true');
      paramCount++;
    }

    if (deviceId) {
      query += ` AND device_id = $${paramCount}`;
      params.push(deviceId);
      paramCount++;
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    const result = await pool.query(query, params);

    const alerts = result.rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
    }));

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getAlertById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM alerts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Alert not found');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    const alert = {
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
    };

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

export const createAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceId, deviceName, message, severity = 'info' } = req.body;

    if (!deviceId || !deviceName || !message) {
      const error: ApiError = new Error('Device ID, device name, and message are required');
      error.statusCode = 400;
      throw error;
    }

    // Verify device exists
    const deviceCheck = await pool.query('SELECT id FROM devices WHERE id = $1', [deviceId]);
    if (deviceCheck.rows.length === 0) {
      const error: ApiError = new Error('Device not found');
      error.statusCode = 404;
      throw error;
    }

    const result = await pool.query(
      `INSERT INTO alerts (device_id, device_name, message, severity)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [deviceId, deviceName, message, severity]
    );

    const row = result.rows[0];
    const alert = {
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
    };

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

export const acknowledgeAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;

    const result = await pool.query(
      `UPDATE alerts 
       SET acknowledged = TRUE, 
           acknowledged_at = CURRENT_TIMESTAMP,
           acknowledged_by = $1
       WHERE id = $2
       RETURNING *`,
      [acknowledgedBy || null, id]
    );

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Alert not found');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    const alert = {
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
    };

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Alert not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

