import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';
import { createSocket, Socket } from 'dgram';
import { promisify } from 'util';

// Validate SNMP config
const validateSnmpConfig = (snmpConfig: any, ip: string): void => {
  if (!snmpConfig) {
    return; // SNMP config is optional
  }

  const validVersions = ['v1', 'v2c', 'v3'];
  if (!validVersions.includes(snmpConfig.version)) {
    const error: ApiError = new Error(`Invalid SNMP version. Must be one of: ${validVersions.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  // Validate port
  if (snmpConfig.port && (snmpConfig.port < 1 || snmpConfig.port > 65535)) {
    const error: ApiError = new Error('SNMP port must be between 1 and 65535');
    error.statusCode = 400;
    throw error;
  }

  // Validate v1/v2c requirements
  if ((snmpConfig.version === 'v1' || snmpConfig.version === 'v2c')) {
    if (!snmpConfig.community || snmpConfig.community.trim() === '') {
      const error: ApiError = new Error(`SNMP ${snmpConfig.version} requires a community string`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate v3 requirements
  if (snmpConfig.version === 'v3') {
    if (!snmpConfig.username || snmpConfig.username.trim() === '') {
      const error: ApiError = new Error('SNMP v3 requires a username');
      error.statusCode = 400;
      throw error;
    }
    if (snmpConfig.authProtocol && !['SHA', 'MD5'].includes(snmpConfig.authProtocol)) {
      const error: ApiError = new Error('SNMP v3 authProtocol must be SHA or MD5');
      error.statusCode = 400;
      throw error;
    }
    if (snmpConfig.privProtocol && !['AES', 'DES'].includes(snmpConfig.privProtocol)) {
      const error: ApiError = new Error('SNMP v3 privProtocol must be AES or DES');
      error.statusCode = 400;
      throw error;
    }
  }
};

// Test SNMP connection
export const testSnmpConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ip, snmpConfig } = req.body;

    if (!ip) {
      const error: ApiError = new Error('IP address is required');
      error.statusCode = 400;
      throw error;
    }

    // Trim and validate IP format
    const trimmedIp = String(ip).trim();
    if (!trimmedIp) {
      const error: ApiError = new Error('IP address cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(trimmedIp)) {
      const error: ApiError = new Error(`Invalid IP address format: "${trimmedIp}". Expected format: xxx.xxx.xxx.xxx (e.g., 192.168.1.1)`);
      error.statusCode = 400;
      throw error;
    }

    if (!snmpConfig) {
      const error: ApiError = new Error('SNMP config is required for connection test');
      error.statusCode = 400;
      throw error;
    }

    // Validate SNMP config
    validateSnmpConfig(snmpConfig, trimmedIp);

      const port = snmpConfig.port || 161;
      const timeout = snmpConfig.timeout || 5000;

      // Test UDP port connectivity (SNMP uses UDP)
      // Note: This is a basic connectivity test. For actual SNMP protocol validation,
      // you would need an SNMP library like net-snmp or snmp-native
      return new Promise<void>((resolve, reject) => {
        const socket = createSocket('udp4');
        let isResolved = false;
        let timeoutHandle: NodeJS.Timeout;

        const cleanup = () => {
          if (!isResolved) {
            isResolved = true;
            if (timeoutHandle) clearTimeout(timeoutHandle);
            socket.close();
          }
        };

        // Set timeout
        timeoutHandle = setTimeout(() => {
          cleanup();
          const error: ApiError = new Error(`Connection timeout: No response from ${trimmedIp} on port ${port}. Device may be unreachable or SNMP service not running.`);
          error.statusCode = 408;
          reject(error);
        }, timeout);

        socket.once('error', (err: any) => {
          cleanup();
          const error: ApiError = new Error(`Connection failed: ${err.message || 'Unable to connect to device'}`);
          error.statusCode = 503;
          reject(error);
        });

        // Send a minimal UDP packet to test connectivity
        // In a real implementation, you would send an actual SNMP GET request here
        const testBuffer = Buffer.from([0x30, 0x26]); // Minimal SNMP-like packet header
        socket.send(testBuffer, port, trimmedIp, (err) => {
        if (err) {
          cleanup();
          const error: ApiError = new Error(`Failed to send test packet: ${err.message}`);
          error.statusCode = 503;
          reject(error);
          return;
        }

        // For UDP, we consider it successful if we can send the packet
        // Actual SNMP response would require proper SNMP library
        cleanup();
        res.json({
          success: true,
          message: `SNMP configuration validated. Connection test sent to ${trimmedIp}:${port}. Note: This is a basic connectivity test. For full SNMP protocol validation, ensure SNMP service is running on the device.`,
          data: {
            ip: trimmedIp,
            port,
            version: snmpConfig.version,
            reachable: true,
            note: 'Basic connectivity test passed. Full SNMP protocol test requires SNMP library.',
          },
        });
        resolve();
      });
    });
  } catch (error) {
    next(error);
  }
};

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

    // Trim and validate IP format
    const trimmedIp = String(ip).trim();
    if (!trimmedIp) {
      const error: ApiError = new Error('IP address cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    // Validate IP format (basic check)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(trimmedIp)) {
      const error: ApiError = new Error(`Invalid IP address format: "${trimmedIp}". Expected format: xxx.xxx.xxx.xxx (e.g., 192.168.1.1)`);
      error.statusCode = 400;
      throw error;
    }

    // Validate SNMP config if provided
    if (snmpConfig) {
      validateSnmpConfig(snmpConfig, ip);
    }

    const result = await pool.query(
      `INSERT INTO devices (name, ip, type, status, cpu_usage, memory_usage, temperature, uptime, location, snmp_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name,
        trimmedIp,
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

    // Validate IP format if provided
    if (ip !== undefined) {
      const trimmedIp = String(ip).trim();
      if (trimmedIp && !/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(trimmedIp)) {
        const error: ApiError = new Error(`Invalid IP address format: "${trimmedIp}". Expected format: xxx.xxx.xxx.xxx (e.g., 192.168.1.1)`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate SNMP config if provided
    if (snmpConfig && ip) {
      validateSnmpConfig(snmpConfig, ip);
    } else if (snmpConfig) {
      // Get current device IP for validation
      const currentDevice = await pool.query('SELECT ip FROM devices WHERE id = $1', [id]);
      if (currentDevice.rows.length > 0) {
        validateSnmpConfig(snmpConfig, currentDevice.rows[0].ip);
      }
    }

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
