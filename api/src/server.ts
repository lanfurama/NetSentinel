import { createServer } from './server-app.js';

const PORT = process.env.PORT || 3001;
const app = createServer();

// Start server (cho trường hợp chạy riêng)
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api/v1`);
});

