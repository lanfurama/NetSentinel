import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import devicesRoutes from './routes/devices.js';
import alertsRoutes from './routes/alerts.js';
import usersRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { ensureChatTablesExist } from './db/init-chat-tables.js';

dotenv.config();

export async function createServer() {
  // Ensure chat tables exist before starting server
  await ensureChatTablesExist();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'NetSentinel API is running',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes với prefix /api/v1
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/devices', devicesRoutes);
  app.use('/api/v1/alerts', alertsRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/stats', statsRoutes);
  app.use('/api/v1/chat', chatRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Chỉ start server khi chạy trực tiếp file này (không phải Vercel và không phải khi được import)
// Kiểm tra bằng cách xem có environment variable RUN_SERVER được set không
if (process.env.VERCEL !== '1' && process.env.RUN_SERVER === 'true') {
  const PORT = process.env.PORT || 3001;
  createServer().then((app) => {
    app.listen(PORT, () => {
      console.log(`🚀 API Server running on http://localhost:${PORT}`);
      console.log(`📊 API endpoints available at http://localhost:${PORT}/api/v1`);
    });
  }).catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}
