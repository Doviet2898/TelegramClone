const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

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

// Cấu hình CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
mongoose.set('strictQuery', false);

// Thử kết nối với URI từ biến môi trường
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Đã kết nối với MongoDB'))
.catch(err => {
  console.error('Lỗi kết nối MongoDB:', err);
  // Thử kết nối với MongoDB địa phương nếu kết nối Atlas thất bại
  const localUri = 'mongodb://127.0.0.1:27017/telegramClone';
  
  mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('Đã kết nối với MongoDB địa phương'))
    .catch(localErr => {
      console.error('Không thể kết nối với MongoDB:', localErr);
      console.log('Sử dụng MongoDB memory để phát triển...');
      
      // Nếu không thể kết nối với cả hai, tiếp tục chạy ứng dụng
      // Trong môi trường thực tế, có thể nên dừng ứng dụng ở đây
    });
});

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
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  fileUrl: { type: String }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  avatar: { type: String, default: 'default-group-avatar.png' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Group = mongoose.model('Group', groupSchema);

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
    console.log('Nhận yêu cầu đăng nhập:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('Thiếu thông tin đăng nhập');
      return res.status(400).json({ message: 'Vui lòng cung cấp tên người dùng và mật khẩu' });
    }
    
    // Tìm người dùng
    const user = await User.findOne({ username });
    if (!user) {
      console.log('Không tìm thấy người dùng:', username);
      return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng' });
    }
    
    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Mật khẩu không đúng cho người dùng:', username);
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
    
    const responseData = {
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar
      }
    };
    
    console.log('Đăng nhập thành công cho người dùng:', username);
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Lỗi server khi đăng nhập:', error.message);
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
      
      // Chuẩn bị dữ liệu tin nhắn
      const messageData = {
        sender: senderId,
        receiver: receiverId,
        content,
        type,
        fileUrl
      };
      
      // Lưu tin nhắn vào database
      const newMessage = new Message(messageData);
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

  // Xử lý tạo nhóm mới
  socket.on('createGroup', async (data) => {
    try {
      const { name, members, creatorId } = data;
      
      // Kiểm tra dữ liệu đầu vào
      if (!name || !members || !Array.isArray(members) || !creatorId) {
        socket.emit('groupError', { error: 'Dữ liệu không hợp lệ' });
        return;
      }
      
      // Thêm người tạo vào danh sách thành viên nếu chưa có
      if (!members.includes(creatorId)) {
        members.push(creatorId);
      }
      
      // Tạo nhóm mới
      const newGroup = new Group({
        name,
        creator: creatorId,
        members
      });
      
      await newGroup.save();
      
      // Lấy thông tin đầy đủ của nhóm bao gồm thông tin thành viên
      const populatedGroup = await Group.findById(newGroup._id)
        .populate('members', 'username avatar status')
        .populate('creator', 'username avatar');
      
      // Thông báo cho tất cả thành viên về nhóm mới
      members.forEach(memberId => {
        const memberSocketId = onlineUsers.get(memberId);
        if (memberSocketId) {
          io.to(memberSocketId).emit('newGroup', populatedGroup);
        }
      });
      
      // Phản hồi cho người tạo nhóm
      socket.emit('groupCreated', populatedGroup);
    } catch (error) {
      console.error('Lỗi khi tạo nhóm qua socket:', error);
      socket.emit('groupError', { error: 'Không thể tạo nhóm' });
    }
  });
});

// API để tạo nhóm mới
app.post('/api/groups', authenticate, async (req, res) => {
  try {
    const { name, members } = req.body;
    
    if (!name || !members || !Array.isArray(members)) {
      return res.status(400).json({ message: 'Tên nhóm và danh sách thành viên là bắt buộc' });
    }
    
    // Thêm người tạo nhóm vào danh sách thành viên nếu chưa có
    if (!members.includes(req.userData.userId)) {
      members.push(req.userData.userId);
    }
    
    const newGroup = new Group({
      name,
      creator: req.userData.userId,
      members
    });
    
    await newGroup.save();
    
    // Populate thông tin thành viên để trả về
    const populatedGroup = await Group.findById(newGroup._id)
      .populate('members', 'username avatar status')
      .populate('creator', 'username avatar');
    
    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error('Lỗi khi tạo nhóm:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// API để lấy danh sách nhóm của người dùng
app.get('/api/groups', authenticate, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userData.userId })
      .populate('members', 'username avatar status')
      .populate('creator', 'username avatar');
    
    res.status(200).json(groups);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhóm:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// API để lấy tin nhắn của nhóm
app.get('/api/groups/:groupId/messages', authenticate, async (req, res) => {
  try {
    // Kiểm tra xem người dùng có phải là thành viên của nhóm không
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Không tìm thấy nhóm' });
    }
    
    if (!group.members.includes(req.userData.userId)) {
      return res.status(403).json({ message: 'Bạn không phải là thành viên của nhóm này' });
    }
    
    // Lấy tin nhắn của nhóm
    const messages = await Message.find({ 
      receiver: req.params.groupId,
      type: { $in: ['text', 'image', 'file'] }
    }).sort({ timestamp: 1 })
      .populate('sender', 'username avatar');
    
    res.status(200).json(messages);
  } catch (error) {
    console.error('Lỗi khi lấy tin nhắn nhóm:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
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