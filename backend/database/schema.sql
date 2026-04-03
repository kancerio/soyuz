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
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "editedAt" TIMESTAMP
);

-- Создаём индексы для быстрого поиска
CREATE INDEX idx_messages_chat_id ON messages("chatId");
CREATE INDEX idx_messages_user_id ON messages("userId");
CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);