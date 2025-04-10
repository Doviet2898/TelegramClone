// Biến toàn cục
let currentUser = null;
let currentChat = null;
let socket = null;
let typingTimeout = null;
let users = [];
let messages = {};

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const tabBtns = document.querySelectorAll('.tab-btn');
const currentUsername = document.getElementById('current-username');
const currentUserAvatar = document.getElementById('current-user-avatar');
const usersList = document.getElementById('users-list');
const searchInput = document.getElementById('search-input');
const logoutBtn = document.getElementById('logout-btn');
const avatarInput = document.getElementById('avatar-input');
const emptyChat = document.getElementById('empty-chat');
const chatContainer = document.getElementById('chat-container');
const chatUsername = document.getElementById('chat-username');
const chatUserAvatar = document.getElementById('chat-user-avatar');
const chatStatus = document.getElementById('chat-status');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const typingIndicator = document.getElementById('typing-indicator');

// Kiểm tra xem người dùng đã đăng nhập chưa
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // Lấy thông tin người dùng từ localStorage
        currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser) {
            showMainScreen();
            initSocket();
            return;
        }
    }
    showAuthScreen();
}

// Hiển thị màn hình đăng nhập/đăng ký
function showAuthScreen() {
    authScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
}

// Hiển thị màn hình chính
function showMainScreen() {
    authScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    updateCurrentUserInfo();
    fetchUsers();
}

// Cập nhật thông tin người dùng hiện tại
function updateCurrentUserInfo() {
    if (currentUser) {
        currentUsername.textContent = currentUser.username;
        if (currentUser.avatar) {
            currentUserAvatar.src = currentUser.avatar.startsWith('http') 
                ? currentUser.avatar 
                : `/uploads/${currentUser.avatar}`;
        }
    }
}

// Khởi tạo kết nối Socket.IO
function initSocket() {
    socket = io('http://localhost:3000');

    // Đăng nhập vào socket
    socket.emit('login', currentUser.id);

    // Lắng nghe sự kiện trạng thái người dùng thay đổi
    socket.on('userStatusChanged', (data) => {
        updateUserStatus(data.userId, data.status, data.lastSeen);
    });

    // Lắng nghe sự kiện tin nhắn mới
    socket.on('newMessage', (message) => {
        if (message.sender === currentChat?.id) {
            addMessageToChat(message, false);
            scrollToBottom();
            // Đánh dấu tin nhắn đã đọc
            socket.emit('markAsRead', { messageId: message._id });
        } else {
            // Tăng số tin nhắn chưa đọc
            incrementUnreadCount(message.sender);
        }
    });

    // Lắng nghe sự kiện tin nhắn đã gửi
    socket.on('messageSent', (message) => {
        if (message.receiver === currentChat?.id) {
            addMessageToChat(message, true);
            scrollToBottom();
        }
    });

    // Lắng nghe sự kiện tin nhắn đã đọc
    socket.on('messageRead', (data) => {
        const messageElement = document.getElementById(`message-${data.messageId}`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.textContent = 'Đã xem';
            }
        }
    });

    // Lắng nghe sự kiện người dùng đang nhập
    socket.on('userTyping', (data) => {
        if (data.userId === currentChat?.id) {
            typingIndicator.classList.remove('hidden');
        }
    });

    // Lắng nghe sự kiện người dùng dừng nhập
    socket.on('userStopTyping', (data) => {
        if (data.userId === currentChat?.id) {
            typingIndicator.classList.add('hidden');
        }
    });

    // Lắng nghe sự kiện lỗi
    socket.on('messageError', (error) => {
        console.error('Lỗi tin nhắn:', error);
        alert('Không thể gửi tin nhắn. Vui lòng thử lại sau.');
    });
}

// Lấy danh sách người dùng
async function fetchUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Không thể lấy danh sách người dùng');
        }

        users = await response.json();
        renderUsersList(users);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách người dùng:', error);
    }
}

// Hiển thị danh sách người dùng
function renderUsersList(usersList) {
    const usersListElement = document.getElementById('users-list');
    usersListElement.innerHTML = '';

    usersList.forEach(user => {
        const userElement = document.createElement('div');
        userElement.classList.add('user-item');
        userElement.dataset.userId = user._id;

        // Kiểm tra nếu đây là người dùng đang chat
        if (currentChat && user._id === currentChat.id) {
            userElement.classList.add('active');
        }

        userElement.innerHTML = `
            <img src="${user.avatar ? `/uploads/${user.avatar}` : 'default-avatar.png'}" alt="${user.username}">
            <div class="user-item-info">
                <h4>${user.username}</h4>
                <p class="last-message">${getLastMessage(user._id) || 'Bắt đầu trò chuyện'}</p>
            </div>
            <div class="user-meta">
                <span class="message-time">${getLastMessageTime(user._id) || ''}</span>
                ${getUnreadBadge(user._id)}
            </div>
        `;

        userElement.addEventListener('click', () => selectChat(user));
        usersListElement.appendChild(userElement);
    });
}

// Lấy tin nhắn cuối cùng
function getLastMessage(userId) {
    if (!messages[userId] || messages[userId].length === 0) {
        return null;
    }
    const lastMessage = messages[userId][messages[userId].length - 1];
    if (lastMessage.type === 'image') {
        return '🖼️ Hình ảnh';
    }
    return lastMessage.content;
}

// Lấy thời gian tin nhắn cuối cùng
function getLastMessageTime(userId) {
    if (!messages[userId] || messages[userId].length === 0) {
        return null;
    }
    const lastMessage = messages[userId][messages[userId].length - 1];
    return formatTime(new Date(lastMessage.timestamp));
}

// Lấy badge số tin nhắn chưa đọc
function getUnreadBadge(userId) {
    const unreadCount = localStorage.getItem(`unread_${userId}`);
    if (unreadCount && parseInt(unreadCount) > 0) {
        return `<div class="unread-badge">${unreadCount}</div>`;
    }
    return '';
}

// Tăng số tin nhắn chưa đọc
function incrementUnreadCount(userId) {
    let count = parseInt(localStorage.getItem(`unread_${userId}`) || '0');
    count++;
    localStorage.setItem(`unread_${userId}`, count.toString());
    renderUsersList(users);
}

// Xóa số tin nhắn chưa đọc
function clearUnreadCount(userId) {
    localStorage.removeItem(`unread_${userId}`);
}

// Chọn người dùng để chat
async function selectChat(user) {
    // Cập nhật UI
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => item.classList.remove('active'));
    const selectedItem = document.querySelector(`.user-item[data-user-id="${user._id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    // Cập nhật thông tin người dùng đang chat
    currentChat = {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        status: user.status
    };

    // Hiển thị khu vực chat
    emptyChat.classList.add('hidden');
    chatContainer.classList.remove('hidden');

    // Cập nhật thông tin người dùng trong header chat
    chatUsername.textContent = user.username;
    chatUserAvatar.src = user.avatar ? `/uploads/${user.avatar}` : 'default-avatar.png';
    chatStatus.textContent = user.status === 'online' ? 'Online' : 'Offline';
    chatStatus.className = 'status';
    if (user.status === 'online') {
        chatStatus.classList.add('online');
    }

    // Xóa số tin nhắn chưa đọc
    clearUnreadCount(user._id);

    // Lấy lịch sử tin nhắn
    await fetchMessages(user._id);
}

// Lấy lịch sử tin nhắn
async function fetchMessages(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/messages/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Không thể lấy lịch sử tin nhắn');
        }

        const fetchedMessages = await response.json();
        messages[userId] = fetchedMessages;

        // Hiển thị tin nhắn
        renderMessages(fetchedMessages);

        // Cuộn xuống dưới cùng
        scrollToBottom();

        // Đánh dấu tất cả tin nhắn là đã đọc
        fetchedMessages.forEach(message => {
            if (!message.isRead && message.sender === userId) {
                socket.emit('markAsRead', { messageId: message._id });
            }
        });
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử tin nhắn:', error);
    }
}

// Hiển thị tin nhắn
function renderMessages(messagesList) {
    messagesContainer.innerHTML = '';

    messagesList.forEach(message => {
        const isSent = message.sender === currentUser.id;
        addMessageToChat(message, isSent);
    });
}

// Thêm tin nhắn vào khu vực chat
function addMessageToChat(message, isSent) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble');
    messageElement.classList.add(isSent ? 'sent' : 'received');
    messageElement.id = `message-${message._id}`;

    let messageContent = '';
    if (message.type === 'image') {
        messageContent = `<img src="${message.fileUrl}" alt="Hình ảnh" class="message-image">`;
    } else {
        messageContent = message.content;
    }

    messageElement.innerHTML = `
        <div class="message-content">${messageContent}</div>
        <div class="message-info">
            <span class="message-time">${formatTime(new Date(message.timestamp))}</span>
            ${isSent ? `<span class="message-status">${message.isRead ? 'Đã xem' : 'Đã gửi'}</span>` : ''}
        </div>
    `;

    messagesContainer.appendChild(messageElement);
}

// Cuộn xuống dưới cùng khu vực chat
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Định dạng thời gian
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Cập nhật trạng thái người dùng
function updateUserStatus(userId, status, lastSeen) {
    // Cập nhật trong danh sách người dùng
    const userIndex = users.findIndex(user => user._id === userId);
    if (userIndex !== -1) {
        users[userIndex].status = status;
        users[userIndex].lastSeen = lastSeen;
        renderUsersList(users);
    }

    // Cập nhật trong khu vực chat nếu đang chat với người dùng này
    if (currentChat && currentChat.id === userId) {
        chatStatus.textContent = status === 'online' ? 'Online' : 'Offline';
        chatStatus.className = 'status';
        if (status === 'online') {
            chatStatus.classList.add('online');
        }
    }
}

// Gửi tin nhắn
function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    // Gửi tin nhắn qua socket
    socket.emit('sendMessage', {
        senderId: currentUser.id,
        receiverId: currentChat.id,
        content,
        type: 'text'
    });

    // Xóa nội dung input
    messageInput.value = '';
    messageInput.focus();

    // Dừng trạng thái đang nhập
    stopTyping();
}

// Gửi hình ảnh
async function sendImage(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const token = localStorage.getItem('token');
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Không thể tải lên hình ảnh');
        }

        const data = await response.json();

        // Gửi tin nhắn hình ảnh qua socket
        socket.emit('sendMessage', {
            senderId: currentUser.id,
            receiverId: currentChat.id,
            content: 'Hình ảnh',
            type: 'image',
            fileUrl: data.fileUrl
        });
    } catch (error) {
        console.error('Lỗi khi tải lên hình ảnh:', error);
        alert('Không thể tải lên hình ảnh. Vui lòng thử lại sau.');
    }
}

// Cập nhật avatar
async function updateAvatar(file) {
    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const token = localStorage.getItem('token');
        const response = await fetch('/api/update-avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Không thể cập nhật avatar');
        }

        const data = await response.json();

        // Cập nhật avatar trong localStorage
        currentUser.avatar = data.avatar;
        localStorage.setItem('user', JSON.stringify(currentUser));

        // Cập nhật UI
        currentUserAvatar.src = `/uploads/${data.avatar}`;
    } catch (error) {
        console.error('Lỗi khi cập nhật avatar:', error);
        alert('Không thể cập nhật avatar. Vui lòng thử lại sau.');
    }
}

// Xử lý đang nhập
function handleTyping() {
    if (!socket || !currentChat) return;

    // Gửi sự kiện đang nhập
    socket.emit('typing', {
        senderId: currentUser.id,
        receiverId: currentChat.id
    });

    // Xóa timeout cũ nếu có
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }

    // Đặt timeout mới
    typingTimeout = setTimeout(stopTyping, 2000);
}

// Dừng trạng thái đang nhập
function stopTyping() {
    if (!socket || !currentChat) return;

    // Gửi sự kiện dừng nhập
    socket.emit('stopTyping', {
        senderId: currentUser.id,
        receiverId: currentChat.id
    });

    // Xóa timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
}

// Đăng nhập
async function login(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Đăng nhập thất bại');
        }

        // Lưu token và thông tin người dùng
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Cập nhật biến toàn cục
        currentUser = data.user;

        // Hiển thị màn hình chính
        showMainScreen();

        // Khởi tạo kết nối socket
        initSocket();

        return true;
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        return error.message;
    }
}

// Đăng ký
async function register(username, password) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Đăng ký thất bại');
        }

        return true;
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        return error.message;
    }
}

// Đăng xuất
function logout() {
    // Xóa token và thông tin người dùng
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Ngắt kết nối socket
    if (socket) {
        socket.disconnect();
    }

    // Reset biến toàn cục
    currentUser = null;
    currentChat = null;
    socket = null;
    users = [];
    messages = {};

    // Hiển thị màn hình đăng nhập
    showAuthScreen();
}

// Tìm kiếm người dùng
function searchUsers(query) {
    if (!query) {
        renderUsersList(users);
        return;
    }

    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase())
    );
    renderUsersList(filteredUsers);
}

// Event Listeners

// Chuyển tab đăng nhập/đăng ký
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tabName = btn.dataset.tab;
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${tabName}-form`).classList.add('active');
    });
});

// Xử lý đăng nhập
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        loginError.textContent = 'Vui lòng nhập đầy đủ thông tin';
        return;
    }

    loginError.textContent = 'Đang đăng nhập...';
    const result = await login(username, password);

    if (result !== true) {
        loginError.textContent = result;
    }
});

// Xử lý đăng ký
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!username || !password || !confirmPassword) {
        registerError.textContent = 'Vui lòng nhập đầy đủ thông tin';
        return;
    }

    if (password !== confirmPassword) {
        registerError.textContent = 'Mật khẩu xác nhận không khớp';
        return;
    }

    registerError.textContent = 'Đang đăng ký...';
    const result = await register(username, password);

    if (result === true) {
        registerError.textContent = 'Đăng ký thành công! Vui lòng đăng nhập.';
        registerError.style.color = '#2ecc71';

        // Chuyển sang tab đăng nhập
        setTimeout(() => {
            document.querySelector('[data-tab="login"]').click();
            registerError.textContent = '';
            registerError.style.color = '';
        }, 2000);
    } else {
        registerError.textContent = result;
    }
});

// Xử lý đăng xuất
logoutBtn.addEventListener('click', logout);

// Xử lý gửi tin nhắn
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

// Xử lý đang nhập
messageInput.addEventListener('input', handleTyping);

// Xử lý tìm kiếm người dùng
searchInput.addEventListener('input', (e) => {
    searchUsers(e.target.value.trim());
});

// Xử lý tải lên hình ảnh
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        sendImage(e.target.files[0]);
        e.target.value = '';
    }
});

// Xử lý cập nhật avatar
avatarInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        updateAvatar(e.target.files[0]);
        e.target.value = '';
    }
});

// Khởi tạo ứng dụng
checkAuth();

// Thêm ảnh avatar mặc định
const defaultAvatar = document.createElement('img');
defaultAvatar.src = 'default-avatar.png';
defaultAvatar.style.display = 'none';
document.body.appendChild(defaultAvatar);