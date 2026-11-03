## WebSocket подключение

1. Установить: npm install socket.io-client

2. Подключение:
   const socket = io('http://localhost:3000');
   socket.emit('auth', { userId: 1 });

3. Обработчики событий:
   - socket.on('new_message', (msg) => addMessage(msg))
   - socket.on('user_online', ({ userId }) => setOnline(userId))
   - socket.on('user_typing', ({ userId, isTyping }) => showTyping(userId, isTyping))

## REST API

1. Установить: npm install axios

2. Настроить перехватчик токена:
   axios.interceptors.request.use(config => {
     config.headers.Authorization = `Bearer ${token}`;
     return config;
   });

3. Основные эндпоинты:
   - POST /auth/login
   - GET /chats
   - GET /messages/chat/:chatId
   - POST /messages/chat/:chatId