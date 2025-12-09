import type { Plugin } from 'vite';
import { createServer } from './server/src/server-app.js';

export function vitePluginApi(): Plugin {
  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      // Tích hợp Express app trực tiếp vào Vite middleware
      const expressApp = createServer();
      
      console.log('✅ API server đã được tích hợp vào Vite dev server');
      console.log('📊 API endpoints: http://localhost:3000/api/v1/...');
      
      // Middleware để xử lý API requests
      // Mount Express app tại root để nó nhận được full path
      server.middlewares.use((req, res, next) => {
        // Chỉ xử lý requests bắt đầu với /api
        if (req.url?.startsWith('/api')) {
          // Log để debug
          console.log(`[API Request] ${req.method} ${req.url}`);
          
          // Express app sẽ nhận được full path bao gồm /api
          expressApp(req as any, res as any, (err?: any) => {
            if (err) {
              console.error('[API Error]', err);
              next(err);
            } else {
              // Nếu Express đã xử lý response, không gọi next()
              if (!res.headersSent) {
                next();
              }
            }
          });
        } else {
          // Không phải API request, pass qua Vite
          next();
        }
      });
    },
  };
}

