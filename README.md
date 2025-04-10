# Telegram Clone - Ứng dụng nhắn tin thời gian thực

Ứng dụng nhắn tin thời gian thực giống Telegram với các tính năng chính như đăng ký/đăng nhập người dùng, gửi tin nhắn văn bản và hình ảnh theo thời gian thực, hiển thị trạng thái online/offline, và lưu trữ lịch sử tin nhắn.

## Tính năng

- Đăng ký và đăng nhập người dùng
- Hiển thị trạng thái online/offline của người dùng
- Gửi tin nhắn văn bản theo thời gian thực
- Gửi hình ảnh
- Hiển thị trạng thái đã xem tin nhắn
- Hiển thị trạng thái đang nhập
- Tìm kiếm người dùng
- Cập nhật avatar người dùng
- Lưu trữ lịch sử tin nhắn

## Công nghệ sử dụng

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Cơ sở dữ liệu**: MongoDB
- **Kết nối thời gian thực**: Socket.IO
- **Xác thực**: JWT (JSON Web Tokens)
- **Mã hóa mật khẩu**: bcrypt

## Cài đặt

### Yêu cầu

- Node.js (phiên bản 14.x trở lên)
- MongoDB (phiên bản 4.x trở lên)

### Các bước cài đặt

1. Clone repository:
```
git clone <repository-url>
cd TelegramClone
```

2. Cài đặt các dependencies:
```
npm install
```

3. Tạo file .env (hoặc sử dụng file .env đã có):
```
PORT=3000
JWT_SECRET=telegram_clone_secret_key
MONGODB_URI=mongodb://localhost:27017/telegramClone
```

4. Khởi động server:
```
npm start
```

Hoặc chạy ở chế độ development với nodemon:
```
npm run dev
```

5. Truy cập ứng dụng tại địa chỉ: http://localhost:3000

## Cấu trúc thư mục

```
TelegramClone/
├── public/              # Frontend files
│   ├── index.html       # Main HTML file
│   ├── styles.css       # CSS styles
│   ├── app.js           # Frontend JavaScript
│   └── default-avatar.png # Default avatar image
├── uploads/             # Uploaded files (images)
├── server.js            # Main server file
├── package.json         # Project dependencies
└── .env                 # Environment variables
```

## Hướng dẫn sử dụng

1. Đăng ký tài khoản mới hoặc đăng nhập với tài khoản hiện có
2. Chọn một người dùng từ danh sách để bắt đầu trò chuyện
3. Nhập tin nhắn và nhấn Enter hoặc nút Gửi để gửi tin nhắn
4. Sử dụng nút đính kèm để gửi hình ảnh
5. Cập nhật avatar bằng cách nhấp vào biểu tượng máy ảnh trên avatar của bạn

## Phát triển

Ứng dụng này có thể được mở rộng với các tính năng bổ sung như:

- Gửi file và tài liệu
- Tạo nhóm chat
- Gọi video và âm thanh
- Tin nhắn tự hủy
- Thông báo đẩy
- Đồng bộ hóa đa thiết bị