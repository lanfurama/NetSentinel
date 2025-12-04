# NetSentinel API

Backend API cho hệ thống NetSentinel - Network Monitoring System.

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ `.env.example` và cấu hình database:
```bash
cp .env.example .env
```

3. Đảm bảo PostgreSQL đã chạy và database đã được tạo (chạy `schema.sql`)

## Chạy API

```bash
npm run dev
```

Hoặc từ root directory:
```bash
npm run dev:api
```

API sẽ chạy tại `http://localhost:3001`

## API Endpoints

### Health Check
- `GET /health` - Kiểm tra trạng thái API

### Devices
- `GET /api/devices` - Lấy danh sách devices (query: ?status=ONLINE&type=SERVER&location=...)
- `GET /api/devices/:id` - Lấy device theo ID
- `POST /api/devices` - Tạo device mới
- `PUT /api/devices/:id` - Cập nhật device (full update)
- `PATCH /api/devices/:id` - Cập nhật device (partial update)
- `DELETE /api/devices/:id` - Xóa device

### Alerts
- `GET /api/alerts` - Lấy danh sách alerts (query: ?severity=critical&acknowledged=false&deviceId=...)
- `GET /api/alerts/:id` - Lấy alert theo ID
- `POST /api/alerts` - Tạo alert mới
- `PATCH /api/alerts/:id/acknowledge` - Acknowledge alert
- `DELETE /api/alerts/:id` - Xóa alert

### Users
- `GET /api/users` - Lấy danh sách users (query: ?role=admin)
- `GET /api/users/:username` - Lấy user theo username
- `POST /api/users` - Tạo user mới
- `PUT /api/users/:username` - Cập nhật user (full update)
- `PATCH /api/users/:username` - Cập nhật user (partial update)
- `DELETE /api/users/:username` - Xóa user

### Stats
- `GET /api/stats` - Lấy system statistics

## Response Format

Tất cả responses đều có format:
```json
{
  "success": true,
  "data": { ... },
  "count": 10  // (optional, cho list endpoints)
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "message": "Error message"
  }
}
```

