const io = require('socket.io-client');

const socket = io('http://localhost:3000', { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('✅ Connected');
  socket.emit('auth', { userId: 2 });
});

socket.on('auth_success', (data) => {
  console.log('✅ Auth success:', data);
  console.log('📢 Waiting for messages...');
});

socket.on('new_message', (message) => {
  console.log('📨 New message (оригинал):', {
    id: message.id,
    content: message.content,
    translateStatus: message.translateStatus,
  });
});

socket.on('message_translated', (data) => {
  console.log('🌐 Message translated:', data);
});

socket.on('error', (err) => {
  console.error('❌ Error:', err);
});

console.log('📢 Client running. Press Ctrl+C to stop.');
