import { createServer } from './server-app.js';

const PORT = process.env.PORT || 3001;

// Start server (cho trường hợp chạy riêng)
createServer().then((app) => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/v1`);
  });
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

