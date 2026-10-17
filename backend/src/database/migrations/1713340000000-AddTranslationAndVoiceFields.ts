import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranslationAndVoiceFields1713340000000 implements MigrationInterface {
  name = 'AddTranslationAndVoiceFields1713340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Поля перевода (originalText, sourceLang, translatedText, targetLang, translateStatus)
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "originalText" TEXT;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "sourceLang" VARCHAR(10);`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "translatedText" TEXT;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "targetLang" VARCHAR(10);`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "translateStatus" VARCHAR(20) DEFAULT 'none';`);

    // 2. Поля голосовых сообщений и STT (voiceFileId, voiceMimeType, voiceSize, voiceDuration, transcript, sttStatus, voiceSummary, summaryStatus)
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "voiceFileId" VARCHAR(64);`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "voiceMimeType" VARCHAR(100);`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "voiceSize" INTEGER;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "voiceDuration" INTEGER;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "transcript" TEXT;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "sttStatus" VARCHAR(20) DEFAULT 'none';`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "voiceSummary" TEXT;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "summaryStatus" VARCHAR(20) DEFAULT 'none';`);

    // 3. Индекс для быстрого поиска голосовых файлов по voiceFileId
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_messages_voice_file_id ON messages("voiceFileId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_voice_file_id;`);

    // Откат голосовых полей
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "summaryStatus";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "voiceSummary";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "sttStatus";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "transcript";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "voiceDuration";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "voiceSize";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "voiceMimeType";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "voiceFileId";`);

    // Откат полей перевода
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "translateStatus";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "targetLang";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "translatedText";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "sourceLang";`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "originalText";`);
  }
}
