import { createServer } from '../server/src/server-app.js';

// Vercel serverless function entry point
// Note: Vercel will handle async initialization
let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createServer();
  }
  return appPromise;
}

// Export handler for Vercel
export default async (req: any, res: any) => {
  const app = await getApp();
  return app(req, res);
};

