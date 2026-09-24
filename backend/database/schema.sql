-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "refreshToken" VARCHAR(500),
  preferred_language VARCHAR(2) DEFAULT 'en'
);

-- Таблица чатов
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  "isGroup" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Таблица участников чатов (связь many-to-many)
CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  PRIMARY KEY (chat_id, user_id)
);

-- Таблица сообщений
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  "encryptedContent" TEXT,
  "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
  "chatId" INTEGER REFERENCES chats(id) ON DELETE CASCADE,
  "isEdited" BOOLEAN DEFAULT FALSE,
  "isDeleted" BOOLEAN DEFAULT FALSE,
  "isDelivered" BOOLEAN DEFAULT FALSE,
  "isRead" BOOLEAN DEFAULT FALSE,
  "readAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "editedAt" TIMESTAMP
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages("chatId");
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages("userId");
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
