import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { logger } from './logger';

/**
 * Простой in-memory rate limiter: не более maxRequests запросов
 * за windowMs с одного IP на один маршрут. Защищает /auth/* от перебора.
 * Ограничение: счётчик локален для инстанса процесса (без Redis).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  // Лимит: не более 10 запросов в минуту с одного IP на маршрут
  private readonly maxRequests = 10;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const url = req.originalUrl ?? req.url ?? 'unknown';
    const key = `${ip}:${url}`;
    const now = Date.now();

    const window = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (window.length >= this.maxRequests) {
      logger.warn('Rate limit exceeded', {
        event: 'rate_limit_exceeded',
        ip,
        url,
        timestamp: new Date().toISOString(),
      });
      throw new HttpException(
        'Слишком много попыток. Попробуйте через минуту.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.push(now);
    this.hits.set(key, window);
    return true;
  }
}
