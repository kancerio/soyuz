-- Создание таблицы users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  language VARCHAR(10) DEFAULT 'ru',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "refreshToken" VARCHAR(500)
);