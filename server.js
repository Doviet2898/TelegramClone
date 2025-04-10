const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');

// Cấu hình môi trường
dotenv.config();

// Khởi tạo ứng dụng Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cấu hình lưu trữ file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/telegramClone', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Đã kết nối với MongoDB'))
.catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Định nghĩa Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'default-avatar.png' },
  status: { type: String, default: 'offline' },
  lastSeen: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  type: { type: String, enum: ['text', 'image'], default: 'text' },
  fileUrl: { type: String }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// API Routes

// Đăng ký người dùng
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Kiểm tra người dùng đã tồn tại
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Tên người dùng đã tồn tại' });
    }
    
    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Tạo người dùng mới
    const newUser = new User({
      username,
      password: hashedPassword
    });
    
    await newUser.save();
    
    res.status(201).json({ message: 'Đăng ký thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Đăng nhập
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Tìm người dùng
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng' });
    }
    
    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng' });
    }
    
    // Tạo token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );
    
    // Cập nhật trạng thái
    user.status = 'online';
    await user.save();
    
    res.status(200).json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Middleware xác thực
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userData = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Xác thực thất bại' });
  }
};

// Lấy danh sách người dùng
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userData.userId } }, '-password');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Lấy lịch sử tin nhắn
app.get('/api/messages/:userId', authenticate, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.userData.userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.userData.userId }
      ]
    }).sort({ timestamp: 1 });
    
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Upload ảnh
app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file nào được tải lên' });
    }
    
    res.status(200).json({
      message: 'Tải lên thành công',
      fileUrl: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Cập nhật avatar
app.post('/api/update-avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file nào được tải lên' });
    }
    
    const user = await User.findById(req.userData.userId);
    user.avatar = req.file.filename;
    await user.save();
    
    res.status(200).json({
      message: 'Cập nhật avatar thành công',
      avatar: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Socket.IO
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('Người dùng đã kết nối:', socket.id);
  
  // Xử lý đăng nhập
  socket.on('login', async (userId) => {
    onlineUsers.set(userId, socket.id);
    
    // Cập nhật trạng thái người dùng
    await User.findByIdAndUpdate(userId, { status: 'online' });
    
    // Thông báo cho tất cả người dùng
    io.emit('userStatusChanged', { userId, status: 'online' });
  });
  
  // Xử lý tin nhắn mới
  socket.on('sendMessage', async (data) => {
    try {
      const { senderId, receiverId, content, type, fileUrl } = data;
      
      // Lưu tin nhắn vào database
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        content,
        type,
        fileUrl
      });
      
      await newMessage.save();
      
      // Gửi tin nhắn đến người nhận nếu online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', {
          _id: newMessage._id,
          sender: senderId,
          content,
          timestamp: newMessage.timestamp,
          type,
          fileUrl
        });
      }
      
      // Gửi xác nhận về cho người gửi
      socket.emit('messageSent', {
        _id: newMessage._id,
        receiver: receiverId,
        content,
        timestamp: newMessage.timestamp,
        type,
        fileUrl
      });
    } catch (error) {
      console.error('Lỗi gửi tin nhắn:', error);
      socket.emit('messageError', { error: 'Không thể gửi tin nhắn' });
    }
  });
  
  // Xử lý đang nhập
  socket.on('typing', (data) => {
    const { senderId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', { userId: senderId });
    }
  });
  
  // Xử lý dừng nhập
  socket.on('stopTyping', (data) => {
    const { senderId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userStopTyping', { userId: senderId });
    }
  });
  
  // Xử lý đã xem tin nhắn
  socket.on('markAsRead', async (data) => {
    try {
      const { messageId } = data;
      
      await Message.findByIdAndUpdate(messageId, { isRead: true });
      
      // Thông báo cho người gửi
      const message = await Message.findById(messageId);
      const senderSocketId = onlineUsers.get(message.sender.toString());
      
      if (senderSocketId) {
        io.to(senderSocketId).emit('messageRead', { messageId });
      }
    } catch (error) {
      console.error('Lỗi đánh dấu đã đọc:', error);
    }
  });
  
  // Xử lý ngắt kết nối
  socket.on('disconnect', async () => {
    console.log('Người dùng đã ngắt kết nối:', socket.id);
    
    // Tìm userId từ socketId
    let disconnectedUserId = null;
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        break;
      }
    }
    
    if (disconnectedUserId) {
      // Xóa khỏi danh sách online
      onlineUsers.delete(disconnectedUserId);
      
      // Cập nhật trạng thái và thời gian hoạt động cuối
      await User.findByIdAndUpdate(disconnectedUserId, {
        status: 'offline',
        lastSeen: new Date()
      });
      
      // Thông báo cho tất cả người dùng
      io.emit('userStatusChanged', {
        userId: disconnectedUserId,
        status: 'offline',
        lastSeen: new Date()
      });
    }
  });
});

// Tạo thư mục uploads nếu chưa tồn tại
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Khởi động server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});