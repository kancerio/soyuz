const io = require('socket.io-client');
const readline = require('readline');

const socket = io('http://localhost:3000', { transports: ['websocket'] });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  socket.emit('auth', { userId: 5 });
});

socket.on('auth_success', (data) => {
  console.log('✅ Auth success:', data);
  socket.emit('join_chat', { chatId: 3 });
});

socket.on('chat_joined', (data) => {
  console.log(`✅ Joined chat: ${data.chatId}`);
  console.log('\n📢 Type your message and press Enter:');
  rl.on('line', (input) => {
    if (input.trim()) {
      socket.emit('send_message', { chatId: 3, content: input });
      console.log('📤 Message sent via WebSocket');
    }
  });
});

socket.on('new_message', (message) => {
  console.log(`📨 New message received:`, message);
  socket.emit('message_delivered', { messageId: message.id });
  setTimeout(() => {
    socket.emit('message_read', { messageId: message.id });
  }, 2000);
});

socket.on('message_status_update', (data) => {
  console.log(`✅ Status update: Message ${data.messageId} is ${data.status}`);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

console.log('📢 Client waiting for messages...');