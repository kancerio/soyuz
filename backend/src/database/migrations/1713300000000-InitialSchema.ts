import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1713300000000 implements MigrationInterface {
  name = 'InitialSchema1713300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Таблица пользователей
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "refreshToken" VARCHAR(500),
        preferred_language VARCHAR(10) DEFAULT 'en'
      );
    `);

    // 2. Таблица чатов
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        "isGroup" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Таблица участников чатов (many-to-many)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        PRIMARY KEY (chat_id, user_id)
      );
    `);

    // 4. Таблица сообщений (базовая структура)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        "encryptedContent" TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        "isEdited" BOOLEAN DEFAULT FALSE,
        "isDeleted" BOOLEAN DEFAULT FALSE,
        "isDelivered" BOOLEAN DEFAULT FALSE,
        "isRead" BOOLEAN DEFAULT FALSE,
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "editedAt" TIMESTAMP
      );
    `);

    // Older databases were created from TypeORM entity metadata before this migration existed.
    // Those schemas use camelCase relation columns, while Message maps them to snake_case.
    if (!(await queryRunner.hasColumn('messages', 'chat_id')) && (await queryRunner.hasColumn('messages', 'chatId'))) {
      await queryRunner.renameColumn('messages', 'chatId', 'chat_id');
    }
    if (!(await queryRunner.hasColumn('messages', 'user_id')) && (await queryRunner.hasColumn('messages', 'userId'))) {
      await queryRunner.renameColumn('messages', 'userId', 'user_id');
    }

    // Existing tables created from older entity metadata may lack delivery-state columns.
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "isDelivered" BOOLEAN DEFAULT FALSE;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN DEFAULT FALSE;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP;`);

    // Индексы
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS messages CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_participants CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS chats CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE;`);
  }
}
