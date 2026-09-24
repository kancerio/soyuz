import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../redis/redis.service';

export interface TranslateResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  status: 'completed' | 'failed';
  mock: boolean;
}

export interface AssistResult {
  originalText: string;
  resultText: string;
  action: 'shorten' | 'formal' | 'friendly';
  status: 'completed' | 'failed';
  mock: boolean;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly aiBaseUrl: string;
  private readonly timeoutMs = 10000;
  private readonly maxRetries = 1;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.aiBaseUrl = this.configService.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  /**
   * Перевод текста через AI /translate
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslateResult> {
    const trimmed = text.trim();

    if (!trimmed) {
      return {
        originalText: text,
        translatedText: '',
        sourceLang,
        targetLang,
        status: 'failed',
        mock: false,
      };
    }

    if (trimmed.length > 5000) {
      this.logger.warn(`Text too long: ${trimmed.length} chars`);
      return {
        originalText: text,
        translatedText: '',
        sourceLang,
        targetLang,
        status: 'failed',
        mock: false,
      };
    }

    // Если языки совпадают — пропускаем перевод
    if (sourceLang === targetLang && sourceLang !== 'auto') {
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        status: 'completed',
        mock: false,
      };
    }

    // Проверяем кэш
    const cacheKey = `translate:${sourceLang}:${targetLang}:${this.hashText(trimmed)}`;
    const cached = await this.redisService.get<TranslateResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Translation from cache: ${cacheKey}`);
      return cached;
    }

    // Вызываем AI с retry
    const result = await this.callAiWithRetry(trimmed, sourceLang, targetLang);

    // Кэшируем на 1 час (только успешные переводы)
    if (result.status === 'completed') {
      await this.redisService.set(cacheKey, result, 3600);
    }

    return result;
  }

  /**
   * AI-rewrite через /assist
   */
  async assist(
    text: string,
    action: 'shorten' | 'formal' | 'friendly',
  ): Promise<AssistResult> {
    const trimmed = text.trim();

    if (!trimmed || trimmed.length > 5000) {
      return {
        originalText: text,
        resultText: '',
        action,
        status: 'failed',
        mock: false,
      };
    }

    const payload = {
      prompt: trimmed,
      text: trimmed,
      action,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiBaseUrl}/assist`, payload, {
          timeout: this.timeoutMs,
        }),
      );

      const result = response.data.result || response.data.translated_text;

      // Если AI не поддерживает режим — возвращаем mock-фолбэк
      if (!result || result === 'Неизвестное действие' || result.trim() === '') {
        this.logger.warn(`Assist returned unknown action for "${action}"`);
        return {
          originalText: text,
          resultText: this.buildMockResult(trimmed, action),
          action,
          status: 'completed',
          mock: true,
        };
      }

      return {
        originalText: text,
        resultText: result,
        action,
        status: 'completed',
        mock: response.data.mock || false,
      };
    } catch (error) {
      this.logger.error(`Assist failed: ${error.message}`);
      return {
        originalText: text,
        resultText: '',
        action,
        status: 'failed',
        mock: false,
      };
    }
  }

  /**
   * Mock-фолбэк для режимов, которые AI пока не поддерживает
   */
  private buildMockResult(text: string, action: 'shorten' | 'formal' | 'friendly'): string {
    switch (action) {
      case 'shorten':
        return text.length > 160 ? text.slice(0, 157) + '...' : text;
      case 'formal':
        return `[Официально] ${text}`;
      case 'friendly':
        return `[Дружелюбно] ${text}`;
      default:
        return text;
    }
  }

  /**
   * Вызов AI /translate с retry
   */
  private async callAiWithRetry(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslateResult> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const payload = {
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
        };

        const response = await firstValueFrom(
          this.httpService.post(`${this.aiBaseUrl}/translate`, payload, {
            timeout: this.timeoutMs,
          }),
        );

        return {
          originalText: text,
          translatedText: response.data.translated_text || response.data.result,
          sourceLang: response.data.source_lang || sourceLang,
          targetLang: response.data.target_lang || targetLang,
          status: 'completed',
          mock: response.data.mock || false,
        };
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        // Retry только для 503 или timeout
        if (status === 503 || error.code === 'ECONNABORTED') {
          this.logger.warn(
            `Translate attempt ${attempt + 1} failed (${status || 'timeout'}), retrying...`,
          );
          continue;
        }

        // Для остальных ошибок — сразу выходим
        break;
      }
    }

    this.logger.error(`Translate failed: ${lastError?.message}`);
    return {
      originalText: text,
      translatedText: '',
      sourceLang,
      targetLang,
      status: 'failed',
      mock: false,
    };
  }

  /**
   * Хэш текста для кэша
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}