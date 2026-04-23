const io = require('socket.io-client');

const socket = io('http://localhost:3000');

let currentUser = null;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Аутентификация (измени userId на свой)
  const userId = 4; // finaluser
  console.log(`📢 Authenticating as user ${userId}`);
  socket.emit('auth', { userId });
});

socket.on('auth_success', (data) => {
  console.log('✅ Auth success:', data);
  currentUser = data.userId;
  
  // Отправляем тестовое сообщение в чат 2
  setTimeout(() => {
    console.log('📢 Sending test message...');
    socket.emit('send_message', { chatId: 2, content: 'Hello via WebSocket!' });
  }, 1000);
});

socket.on('new_message', (message) => {
  console.log('📨 New message received:', message);
});

socket.on('message_updated', (data) => {
  console.log('📝 Message updated:', data);
});

socket.on('message_deleted', (data) => {
  console.log('🗑️ Message deleted:', data);
});

socket.on('user_online', ({ userId }) => {
  console.log(`🟢 User ${userId} is online`);
});

socket.on('user_offline', ({ userId }) => {
  console.log(`🔴 User ${userId} is offline`);
});

socket.on('user_typing', ({ userId, chatId, isTyping }) => {
  console.log(`⌨️ User ${userId} is ${isTyping ? 'typing...' : 'stopped typing'} in chat ${chatId}`);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

// Отправляем индикатор печатает
setTimeout(() => {
  if (currentUser) {
    console.log('📢 Sending typing indicator...');
    socket.emit('typing', { chatId: 2, isTyping: true });
    
    setTimeout(() => {
      socket.emit('typing', { chatId: 2, isTyping: false });
    }, 2000);
  }
}, 3000);

process.on('SIGINT', () => {
  console.log('👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});