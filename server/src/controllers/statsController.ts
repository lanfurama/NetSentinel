import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';

export const getSystemStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pool.query('SELECT * FROM system_stats');
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalDevices: stats.total_devices,
        online: stats.online,
        offline: stats.offline,
        critical: stats.critical,
        avgCpuLoad: parseFloat(stats.avg_cpu_load),
      },
    });
  } catch (error) {
    next(error);
  }
};

