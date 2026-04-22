const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected! ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.log('❌ Error:', error.message);
});

socket.on('connected', (data) => {
  console.log('📨 Message from server:', data);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Оставляем процесс открытым
setTimeout(() => {
  console.log('Test finished');
  process.exit(0);
}, 5000);