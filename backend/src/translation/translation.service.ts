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
  error?: string;
  providerStatus?: number;
}

export interface AssistResult {
  originalText: string;
  resultText: string;
  action: 'shorten' | 'formal' | 'friendly';
  status: 'completed' | 'failed';
  mock: boolean;
  error?: string;
  providerStatus?: number;
}

export interface SttResult {
  transcript: string;
  summary?: string;
  language: string;
  status: 'completed' | 'failed';
  provider?: string;
  error?: string;
  providerStatus?: number;
}

export interface SummaryResult {
  summary: string;
  status: 'completed' | 'failed';
  error?: string;
  providerStatus?: number;
}

export interface SummaryMessageInput {
  sender_id: string;
  text: string;
  timestamp?: string;
}

export interface StructuredSummaryResult extends SummaryResult {
  decisions: string[];
  participants: string[];
  language: string;
  provider: string;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly aiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly sttTimeoutMs: number;
  private readonly maxRetries = 1;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.aiBaseUrl = this.configService.get('AI_SERVICE_URL', 'http://localhost:8000');
    this.timeoutMs = this.configService.get<number>('AI_REQUEST_TIMEOUT_MS', 120000);
    this.sttTimeoutMs = this.configService.get<number>('AI_STT_TIMEOUT_MS', 120000);
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
      text: trimmed,
      action,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiBaseUrl}/assist`, payload, {
          timeout: this.timeoutMs,
        }),
      );

      const result = response.data.result;

      // Не подменяем невалидный ответ реального провайдера mock-текстом.
      if (!result || result === 'Неизвестное действие' || result.trim() === '') {
        this.logger.warn(`Assist returned unknown action for "${action}"`);
        return {
          originalText: text,
          resultText: '',
          action,
          status: 'failed',
          mock: false,
          error: 'AI assistant returned an empty or unsupported result',
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
        error: error.message,
        providerStatus: error.response?.status,
      };
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
        const translatedText = response.data.result || response.data.translated_text;
        if (typeof translatedText !== 'string' || !translatedText.trim()) {
          throw new Error('AI translation response did not contain result');
        }

        return {
          originalText: text,
          translatedText: translatedText.trim(),
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
      error: lastError?.message,
      providerStatus: lastError?.response?.status,
    };
  }

  /**
   * Распознавание речи через AI /stt
   */
  async transcribeAudio(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    language: string = 'ru',
  ): Promise<SttResult> {
    let lastError: any = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
        formData.append('audio', blob, filename);
        formData.append('language', language);

        const response = await firstValueFrom(
          this.httpService.post(`${this.aiBaseUrl}/stt`, formData, {
            timeout: this.sttTimeoutMs,
          }),
        );

        return {
          transcript: response.data.recognized_text || '',
          summary: response.data.summary || undefined,
          language: response.data.language || language,
          status: 'completed',
          provider: response.data.provider,
        };
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        if (status === 503 || error.code === 'ECONNABORTED') {
          this.logger.warn(`STT attempt ${attempt + 1} failed (${status || 'timeout'}), retrying...`);
          continue;
        }
        break;
      }
    }

    return {
      transcript: '',
      language,
      status: 'failed',
      error: lastError?.message,
      providerStatus: lastError?.response?.status,
    };
  }

  /**
   * Генерация краткого резюме текста через согласованный AI API /summary
   */
  async generateSummary(text: string): Promise<SummaryResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { summary: '', status: 'failed' };
    }

    const result = await this.summarizeMessages(
      [{ sender_id: 'voice', text: trimmed }],
      'ru',
    );
    return { summary: result.summary, status: result.status };
  }

  async summarizeMessages(
    messages: SummaryMessageInput[],
    language: string,
  ): Promise<StructuredSummaryResult> {
    const failed: StructuredSummaryResult = {
      summary: '',
      decisions: [],
      participants: [],
      language,
      provider: 'unknown',
      status: 'failed',
    };
    if (!messages.length || messages.some((message) => !message.text.trim())) {
      return failed;
    }

    const payload = { messages, language };
    let lastError: any;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        let response;
        try {
          // Согласованный контракт: POST /summary
          response = await firstValueFrom(
            this.httpService.post(
              `${this.aiBaseUrl}/summary`,
              payload,
              { timeout: this.timeoutMs },
            ),
          );
        } catch (postErr: any) {
          if (postErr.response?.status === 404 || postErr.response?.status === 422) {
            // Фолбэк на /secretary
            const combinedText = messages.map((m) => m.text).join('\n');
            response = await firstValueFrom(
              this.httpService.post(
                `${this.aiBaseUrl}/secretary`,
                { action: 'summary', details: combinedText },
                { timeout: this.timeoutMs },
              ),
            );
          } else {
            throw postErr;
          }
        }

        const data = response?.data || {};
        const summary =
          data.summary ||
          data.result ||
          data.message ||
          '';
        if (typeof summary !== 'string' || !summary.trim()) {
          throw new Error('AI summary response did not contain summary');
        }
        return {
          summary: summary.trim(),
          decisions: Array.isArray(data.decisions) ? data.decisions : [],
          participants: Array.isArray(data.participants) ? data.participants : [],
          language: data.language || language,
          provider: data.provider || 'unknown',
          status: 'completed',
        };
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        if (status === 503 || error.code === 'ECONNABORTED') {
          this.logger.warn(`Summary attempt ${attempt + 1} failed (${status || 'timeout'}), retrying...`);
          continue;
        }
        break;
      }
    }

    return {
      ...failed,
      error: lastError?.message,
      providerStatus: lastError?.response?.status,
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
