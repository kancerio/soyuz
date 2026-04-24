Backend для мессенджера Soyuz

Технологии
- NestJS 11
- PostgreSQL
- Redis
- WebSocket (Socket.IO)
- JWT авторизация

Установка и запуск

\`\`\`bash
cd backend
npm install
copy .env.example .env  # заполните переменные
npm run start:dev
\`\`\`

## API документация

### REST API
Базовый URL: `http://localhost:3000`

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/auth/register` | Регистрация |
| POST | `/auth/login` | Вход |
| GET | `/chats` | Список чатов |
| GET | `/messages/chat/:chatId` | История сообщений |

### WebSocket
Подключение: `ws://localhost:3000`

События описаны в integration checklist.

## Тестирование

\`\`\`bash
node test-final.js
\`\`\`

## Структура проекта

\`\`\`
backend/
├── src/
│   ├── auth/          # JWT авторизация
│   ├── users/         # Пользователи
│   ├── chats/         # Чаты + WebSocket Gateway
│   ├── messages/      # Сообщения
│   └── redis/         # Redis сервис
├── test.js            # Тесты WebSocket
└── package.json
\`\`\`