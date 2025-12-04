import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';

export const getAllDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, type, location } = req.query;
    let query = 'SELECT * FROM devices WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (type) {
      query += ` AND type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (location) {
      query += ` AND location = $${paramCount}`;
      params.push(location);
      paramCount++;
    }

    query += ' ORDER BY last_seen DESC';

    const result = await pool.query(query, params);
    
    const devices = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      ip: row.ip,
      type: row.type,
      status: row.status,
      cpuUsage: parseFloat(row.cpu_usage),
      memoryUsage: parseFloat(row.memory_usage),
      temperature: row.temperature ? parseFloat(row.temperature) : null,
      uptime: parseInt(row.uptime),
      lastSeen: row.last_seen,
      location: row.location,
      snmpConfig: row.snmp_config,
    }));

    res.json({
      success: true,
      data: devices,
      count: devices.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeviceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Device not found');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    const device = {
      id: row.id,
      name: row.name,
      ip: row.ip,
      type: row.type,
      status: row.status,
      cpuUsage: parseFloat(row.cpu_usage),
      memoryUsage: parseFloat(row.memory_usage),
      temperature: row.temperature ? parseFloat(row.temperature) : null,
      uptime: parseInt(row.uptime),
      lastSeen: row.last_seen,
      location: row.location,
      snmpConfig: row.snmp_config,
    };

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    next(error);
  }
};

export const createDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      ip,
      type,
      status = 'OFFLINE',
      cpuUsage = 0,
      memoryUsage = 0,
      temperature,
      uptime = 0,
      location,
      snmpConfig,
    } = req.body;

    if (!name || !ip || !type) {
      const error: ApiError = new Error('Name, IP, and type are required');
      error.statusCode = 400;
      throw error;
    }

    const result = await pool.query(
      `INSERT INTO devices (name, ip, type, status, cpu_usage, memory_usage, temperature, uptime, location, snmp_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name,
        ip,
        type,
        status,
        cpuUsage,
        memoryUsage,
        temperature || null,
        uptime,
        location || null,
        snmpConfig ? JSON.stringify(snmpConfig) : null,
      ]
    );

    const row = result.rows[0];
    const device = {
      id: row.id,
      name: row.name,
      ip: row.ip,
      type: row.type,
      status: row.status,
      cpuUsage: parseFloat(row.cpu_usage),
      memoryUsage: parseFloat(row.memory_usage),
      temperature: row.temperature ? parseFloat(row.temperature) : null,
      uptime: parseInt(row.uptime),
      lastSeen: row.last_seen,
      location: row.location,
      snmpConfig: row.snmp_config,
    };

    res.status(201).json({
      success: true,
      data: device,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique violation
      const apiError: ApiError = new Error('Device with this IP already exists');
      apiError.statusCode = 409;
      next(apiError);
    } else {
      next(error);
    }
  }
};

export const updateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      name,
      ip,
      type,
      status,
      cpuUsage,
      memoryUsage,
      temperature,
      uptime,
      location,
      snmpConfig,
      lastSeen,
    } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (ip !== undefined) {
      updates.push(`ip = $${paramCount++}`);
      values.push(ip);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (cpuUsage !== undefined) {
      updates.push(`cpu_usage = $${paramCount++}`);
      values.push(cpuUsage);
    }
    if (memoryUsage !== undefined) {
      updates.push(`memory_usage = $${paramCount++}`);
      values.push(memoryUsage);
    }
    if (temperature !== undefined) {
      updates.push(`temperature = $${paramCount++}`);
      values.push(temperature);
    }
    if (uptime !== undefined) {
      updates.push(`uptime = $${paramCount++}`);
      values.push(uptime);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (snmpConfig !== undefined) {
      updates.push(`snmp_config = $${paramCount++}`);
      values.push(snmpConfig ? JSON.stringify(snmpConfig) : null);
    }
    if (lastSeen !== undefined) {
      updates.push(`last_seen = $${paramCount++}`);
      values.push(lastSeen);
    }

    if (updates.length === 0) {
      const error: ApiError = new Error('No fields to update');
      error.statusCode = 400;
      throw error;
    }

    values.push(id);
    const query = `UPDATE devices SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Device not found');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    const device = {
      id: row.id,
      name: row.name,
      ip: row.ip,
      type: row.type,
      status: row.status,
      cpuUsage: parseFloat(row.cpu_usage),
      memoryUsage: parseFloat(row.memory_usage),
      temperature: row.temperature ? parseFloat(row.temperature) : null,
      uptime: parseInt(row.uptime),
      lastSeen: row.last_seen,
      location: row.location,
      snmpConfig: row.snmp_config,
    };

    res.json({
      success: true,
      data: device,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      const apiError: ApiError = new Error('Device with this IP already exists');
      apiError.statusCode = 409;
      next(apiError);
    } else {
      next(error);
    }
  }
};

export const deleteDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      const error: ApiError = new Error('Device not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

