const io = require('socket.io-client');

// Настройки
const SERVER_URL = 'http://localhost:3000';
const TEST_USER_ID = 4;  // finaluser (owner)
const TEST_CHAT_ID = 3;   // группа, которую создали

const socket = io(SERVER_URL, {
  transports: ['websocket'],
});

let currentUser = null;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Аутентификация
  console.log(`📢 Authenticating as user ${TEST_USER_ID}`);
  socket.emit('auth', { userId: TEST_USER_ID });
});

socket.on('auth_success', (data) => {
  console.log('✅ Auth success:', data);
  currentUser = data.userId;
  
  // Отправляем тестовое сообщение
  setTimeout(() => {
    console.log('📢 Sending test message...');
    socket.emit('send_message', { chatId: TEST_CHAT_ID, content: 'Hello via WebSocket!' });
  }, 1000);
});

// Новое сообщение
socket.on('new_message', (message) => {
  console.log('📨 New message received:', message);
});

// Сообщение обновлено
socket.on('message_updated', (data) => {
  console.log('📝 Message updated:', data);
});

// Сообщение удалено
socket.on('message_deleted', (data) => {
  console.log('🗑️ Message deleted:', data);
});

// Пользователь онлайн
socket.on('user_online', ({ userId }) => {
  console.log(`🟢 User ${userId} is online`);
});

// Пользователь офлайн
socket.on('user_offline', ({ userId }) => {
  console.log(`🔴 User ${userId} is offline`);
});

// Индикатор печатает
socket.on('user_typing', ({ userId, chatId, isTyping }) => {
  console.log(`⌨️ User ${userId} is ${isTyping ? 'typing...' : 'stopped typing'} in chat ${chatId}`);
});

// Ошибка
socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Отключение
socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

// Отправляем индикатор печатает
setTimeout(() => {
  if (currentUser) {
    console.log('📢 Sending typing indicator...');
    socket.emit('typing', { chatId: TEST_CHAT_ID, isTyping: true });
    
    setTimeout(() => {
      socket.emit('typing', { chatId: TEST_CHAT_ID, isTyping: false });
    }, 2000);
  }
}, 3000);

// Закрытие соединения через 10 секунд
setTimeout(() => {
  console.log('👋 Test finished, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 15000);

process.on('SIGINT', () => {
  console.log('👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});