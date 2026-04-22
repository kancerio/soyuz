const io = require('socket.io-client');
const http = require('http');

// ========== СНАЧАЛА ПОЛУЧАЕМ ТОКЕН ==========
console.log('📌 Получение JWT токена...');

const loginData = JSON.stringify({
  email: 'test@example.com',
  password: '123456'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      const token = response.accessToken;
      console.log('✅ Токен получен');
      
      // Запускаем WebSocket тесты
      runWebSocketTests(token);
    } catch(e) {
      console.error('❌ Ошибка получения токена:', e.message);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('❌ Ошибка логина:', e.message);
});

loginReq.write(loginData);
loginReq.end();

// ========== WEBSOCKET ТЕСТЫ ==========
function runWebSocketTests(token) {
  console.log('\n📌 Запуск WebSocket тестов...\n');
  
  const socket = io('http://localhost:3000');
  let lastMessageId = null;
  let step = 0;
  
  function log(msg) { console.log(`[${step}] ${msg}`); }
  
  socket.on('connect', () => {
    log('✅ Connected');
    socket.emit('auth', { userId: 1 });
    step++;
  });
  
  socket.on('auth_success', () => {
    log('✅ Auth success');
    socket.emit('join_chat', { chatId: 1 });
    step++;
  });
  
  socket.on('chat_joined', () => {
    log('✅ Joined chat');
    socket.emit('send_message', { chatId: 1, content: 'Test message ' + Date.now() });
    step++;
  });
  
  socket.on('new_message', (msg) => {
    if (!lastMessageId) {
      lastMessageId = msg.id;
      log(`✅ Message sent, ID: ${lastMessageId}`);
      
      // Редактируем
      socket.emit('edit_message', { messageId: lastMessageId, content: 'EDITED!' });
      step++;
    } else {
      log(`📨 New message from others: ${msg.id}`);
    }
  });
  
  socket.on('message_updated', (data) => {
    log(`✅ Message edited: ${data.id} -> "${data.content}"`);
    
    // Удаляем
    socket.emit('delete_message', { messageId: lastMessageId });
    step++;
  });
  
  socket.on('message_deleted', (data) => {
    log(`✅ Message deleted: ${data.id}`);
    
    // Проверяем REST API С ТОКЕНОМ
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/messages/chat/1?limit=10',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    http.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const messages = JSON.parse(body);
          if (Array.isArray(messages)) {
            log(`✅ REST API вернул ${messages.length} сообщений`);
          } else {
            log(`❌ REST API вернул не массив: ${JSON.stringify(messages)}`);
          }
        } catch(e) {
          log(`❌ REST API ошибка: ${e.message}`);
        }
        console.log('\n🎉 Тесты завершены!');
        process.exit(0);
      });
    }).on('error', (e) => {
      log(`❌ HTTP error: ${e.message}`);
      process.exit(1);
    });
    step++;
  });
  
  socket.on('error', (err) => {
    log(`❌ Error: ${err.message}`);
  });
  
  setTimeout(() => {
    log('❌ Timeout');
    process.exit(1);
  }, 15000);
}