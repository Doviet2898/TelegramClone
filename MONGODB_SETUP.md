# Hướng dẫn Cài đặt MongoDB Server

## Bước 1: Tải MongoDB Community Server
1. Truy cập trang web chính thức của MongoDB: https://www.mongodb.com/try/download/community
2. Chọn phiên bản MongoDB Community Server mới nhất
3. Chọn Platform: Windows
4. Package: MSI
5. Nhấn Download

## Bước 2: Cài đặt MongoDB
1. Chạy file MSI vừa tải về
2. Chọn "Complete" setup type
3. Chọn "Install MongoDB as a Service"
4. Chọn "Run service as Network Service user"
5. Nhấn "Install"

## Bước 3: Cài đặt MongoDB Compass (GUI Tool)
1. Trong quá trình cài đặt, đảm bảo đã chọn "Install MongoDB Compass"
2. Nếu chưa cài đặt, bạn có thể tải về từ: https://www.mongodb.com/try/download/compass

## Bước 4: Kiểm tra cài đặt
1. MongoDB Server sẽ tự động chạy như một Windows Service
2. Mở MongoDB Compass
3. Kết nối với URI mặc định: `mongodb://localhost:27017`

## Bước 5: Cấu hình cho ứng dụng
1. Tạo file .env trong thư mục gốc của dự án (nếu chưa có)
2. Thêm biến môi trường sau:
```
MONGODB_URI=mongodb://localhost:27017/telegramClone
```

## Xác nhận kết nối
1. Khởi động lại server của ứng dụng
2. Kiểm tra console, sẽ thấy thông báo "Đã kết nối với MongoDB"

## Xử lý sự cố
Nếu gặp lỗi kết nối:
1. Kiểm tra MongoDB Service có đang chạy không (Services.msc)
2. Đảm bảo port 27017 không bị chặn bởi firewall
3. Kiểm tra connection string trong file .env

## Lưu ý bảo mật
1. Trong môi trường production, nên thiết lập username và password cho database
2. Không nên để MongoDB Server có thể truy cập từ bên ngoài nếu không cần thiết
3. Luôn giữ MongoDB Server được cập nhật phiên bản mới nhất