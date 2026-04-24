## Архитектура

| Компонент | Технология | Порт |
|-----------|-----------|------|
| Backend | NestJS | 3000 |
| WebSocket | Socket.IO | 3000 |
| База данных | PostgreSQL | 5432 |
| Кэш | Redis | 6379 |

## Переменные окружения

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_DATABASE=soyuz_messenger
JWT_SECRET=mySuperSecretKey
REDIS_HOST=localhost
REDIS_PORT=6379

## Запуск

cd backend
npm install
npm run start:dev

## Ожидаемые AI-эндпоинты

- POST /ai/translate - перевод сообщений
- POST /ai/stt - распознавание речи
- POST /ai/summarize - суммаризация чата
- POST /ai/analyze - анализ документов