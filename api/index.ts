import { createServer } from './src/server-app.js';

// Vercel serverless function entry point
const app = createServer();

// Export handler for Vercel
export default app;

