import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCountryAndMessageTranslations1713400000000 implements MigrationInterface {
  name = 'AddUserCountryAndMessageTranslations1713400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Страна пользователя (ISO 3166-1 alpha-2) — контекст для строительных терминов
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "country_code" VARCHAR(2) DEFAULT 'RU';`,
    );

    // Персональные переводы сообщения: { [lang]: { text, status } }
    await queryRunner.query(
      `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "translations" JSONB DEFAULT '{}'::jsonb;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS "translations";`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "country_code";`);
  }
}
