import { QueryRunner } from 'typeorm';
import { InitialSchema1713300000000 } from './migrations/1713300000000-InitialSchema';
import { AddTranslationAndVoiceFields1713340000000 } from './migrations/1713340000000-AddTranslationAndVoiceFields';
import { AppDataSource } from '../data-source';

describe('TypeORM Migrations (Задача 3)', () => {
  let executedQueries: string[] = [];
  let mockQueryRunner: Partial<QueryRunner>;

  beforeEach(() => {
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        return [];
      }),
      hasColumn: jest.fn().mockImplementation(async (_table: string, column: string) =>
        ['chatId', 'userId'].includes(column),
      ),
      renameColumn: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('1713300000000-InitialSchema', () => {
    const migration = new InitialSchema1713300000000();

    it('up должен создавать таблицы users, chats, chat_participants, messages и индексы', async () => {
      await migration.up(mockQueryRunner as QueryRunner);

      const combinedQueries = executedQueries.join(' ');
      expect(combinedQueries).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(combinedQueries).toContain('CREATE TABLE IF NOT EXISTS chats');
      expect(combinedQueries).toContain('CREATE TABLE IF NOT EXISTS chat_participants');
      expect(combinedQueries).toContain('CREATE TABLE IF NOT EXISTS messages');
      expect(combinedQueries).toContain('idx_messages_chat_id');
      expect(combinedQueries).toContain('idx_messages_user_id');
    });

    it('up должен приводить legacy camelCase внешние ключи к именам, используемым сущностью Message', async () => {
      await migration.up(mockQueryRunner as QueryRunner);

      expect(mockQueryRunner.renameColumn).toHaveBeenCalledWith('messages', 'chatId', 'chat_id');
      expect(mockQueryRunner.renameColumn).toHaveBeenCalledWith('messages', 'userId', 'user_id');
    });

    it('down должен безопасно удалять таблицы в обратном порядке', async () => {
      await migration.down(mockQueryRunner as QueryRunner);

      const combinedQueries = executedQueries.join(' ');
      expect(combinedQueries).toContain('DROP TABLE IF EXISTS messages');
      expect(combinedQueries).toContain('DROP TABLE IF EXISTS chat_participants');
      expect(combinedQueries).toContain('DROP TABLE IF EXISTS chats');
      expect(combinedQueries).toContain('DROP TABLE IF EXISTS users');
    });
  });

  describe('1713340000000-AddTranslationAndVoiceFields', () => {
    const migration = new AddTranslationAndVoiceFields1713340000000();

    it('up должен добавлять поля перевода и voice/STT полей с индексом', async () => {
      await migration.up(mockQueryRunner as QueryRunner);

      const combinedQueries = executedQueries.join(' ');
      // Поля перевода
      expect(combinedQueries).toContain('"originalText"');
      expect(combinedQueries).toContain('"sourceLang"');
      expect(combinedQueries).toContain('"translatedText"');
      expect(combinedQueries).toContain('"targetLang"');
      expect(combinedQueries).toContain('"translateStatus"');

      // Поля голосовых и STT
      expect(combinedQueries).toContain('"voiceFileId"');
      expect(combinedQueries).toContain('"voiceMimeType"');
      expect(combinedQueries).toContain('"voiceSize"');
      expect(combinedQueries).toContain('"voiceDuration"');
      expect(combinedQueries).toContain('"transcript"');
      expect(combinedQueries).toContain('"sttStatus"');
      expect(combinedQueries).toContain('"voiceSummary"');
      expect(combinedQueries).toContain('"summaryStatus"');

      // Индекс voiceFileId
      expect(combinedQueries).toContain('idx_messages_voice_file_id');
    });

    it('down должен откатывать все добавленные поля и индекс', async () => {
      await migration.down(mockQueryRunner as QueryRunner);

      const combinedQueries = executedQueries.join(' ');
      expect(combinedQueries).toContain('DROP INDEX IF EXISTS idx_messages_voice_file_id');
      expect(combinedQueries).toContain('DROP COLUMN IF EXISTS "voiceFileId"');
      expect(combinedQueries).toContain('DROP COLUMN IF EXISTS "transcript"');
      expect(combinedQueries).toContain('DROP COLUMN IF EXISTS "translatedText"');
    });
  });

  describe('AppDataSource', () => {
    it('должен содержать настройки для миграций и отключённый synchronize', () => {
      expect(AppDataSource.options.synchronize).toBe(false);
      expect(AppDataSource.options.migrations).toBeDefined();
    });
  });
});
