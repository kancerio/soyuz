import { ConfigService } from '@nestjs/config';

/**
 * Секрет JWT: в production переменная обязательна — иначе падение при старте.
 * Дефолт 'secretKey123' допустим только для локальной разработки и тестов.
 */
export function resolveJwtSecret(configService: ConfigService): string {
  const secret = configService.get('JWT_SECRET');
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET обязателен в production: задайте переменную окружения');
    }
    return 'secretKey123';
  }
  return secret;
}
