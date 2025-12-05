import http from 'http';

const API_PORT = process.env.API_PORT || 3001;
const API_URL = `http://localhost:${API_PORT}/health`;

console.log(`🔍 Đang kiểm tra API server tại ${API_URL}...`);

const checkApi = () => {
  return new Promise((resolve, reject) => {
    const req = http.get(API_URL, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ API server đang chạy!');
        resolve(true);
      } else {
        reject(new Error(`API server trả về status code: ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Timeout: Không thể kết nối đến API server'));
    });
  });
};

checkApi()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error.message);
    console.error(`\n⚠️  Vui lòng chạy 'npm run dev:api' trước khi chạy 'npm run dev'`);
    console.error(`   API server cần chạy tại http://localhost:${API_PORT}\n`);
    process.exit(1);
  });

