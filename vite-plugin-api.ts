import type { Plugin } from 'vite';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function vitePluginApi(): Plugin {
  let apiProcess: ChildProcess | null = null;
  
  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      // Khởi động Express server trên port 3001 (chạy ngầm)
      const apiCwd = path.join(__dirname, 'server');
      const apiServerPath = path.join('src', 'server-app.ts');
      
      console.log('🚀 Đang khởi động API server...');
      
      // Sử dụng đường dẫn tương đối và cwd để tránh lỗi với khoảng trắng trong đường dẫn
      apiProcess = spawn('npx', ['tsx', 'watch', apiServerPath], {
        cwd: apiCwd,
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, PORT: '3001' },
      });
      
      apiProcess.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[API] ${output}`);
        }
      });
      
      apiProcess.stderr?.on('data', (data) => {
        const output = data.toString().trim();
        if (output && !output.includes('DeprecationWarning')) {
          console.error(`[API Error] ${output}`);
        }
      });
      
      apiProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
          console.error(`[API] Process exited with code ${code}`);
        }
      });
      
      // Đợi API server sẵn sàng
      setTimeout(() => {
        console.log('✅ API server đã sẵn sàng');
        console.log('📊 API endpoints: http://localhost:3000/api/v1/...');
      }, 2000);
    },
    buildEnd() {
      // Dừng API server khi build xong
      if (apiProcess) {
        apiProcess.kill();
        apiProcess = null;
      }
    },
    closeBundle() {
      // Dừng API server khi close
      if (apiProcess) {
        apiProcess.kill();
        apiProcess = null;
      }
    },
  };
}

