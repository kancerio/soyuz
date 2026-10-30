import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TranslationService } from './translation.service';
import { RedisService } from '../redis/redis.service';

describe('TranslationService - Чистый контракт без legacy-полей (Задача 7)', () => {
  let service: TranslationService;
  let mockHttpService: any;
  let mockConfigService: any;
  let mockRedisService: any;

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key, defaultVal) => defaultVal || 'http://localhost:8000'),
    };

    mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<TranslationService>(TranslationService);
  });

  describe('assist() - переход на text/result', () => {
    it('должен отправлять { text, action } без устаревшего поля prompt и возвращать result', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: {
            result: 'Сокращённый текст',
          },
        }),
      );

      const res = await service.assist('Длинный исходный текст', 'shorten');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8000/assist',
        {
          text: 'Длинный исходный текст',
          action: 'shorten',
        },
        expect.any(Object),
      );

      // Проверяем, что в payload нет устаревшего prompt
      const sentPayload = mockHttpService.post.mock.calls[0][1];
      expect(sentPayload).not.toHaveProperty('prompt');
      expect(sentPayload).toHaveProperty('text', 'Длинный исходный текст');

      expect(res.status).toBe('completed');
      expect(res.resultText).toBe('Сокращённый текст');
    });
  });

  describe('translate() - работа с translated_text', () => {
    it('должен отправлять { text, source_lang, target_lang } и возвращать translated_text', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: {
            original_text: 'Привет',
            translated_text: 'Hello',
            source_lang: 'ru',
            target_lang: 'en',
          },
        }),
      );

      const res = await service.translate('Привет', 'ru', 'en');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8000/translate',
        {
          text: 'Привет',
          source_lang: 'ru',
          target_lang: 'en',
        },
        expect.any(Object),
      );

      expect(res.status).toBe('completed');
      expect(res.translatedText).toBe('Hello');
    });

    it('reads the current shared result field returned by the AI API', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { result: 'Good morning', source_lang: 'ru', target_lang: 'en' } }),
      );

      const result = await service.translate('Доброе утро', 'ru', 'en');

      expect(result.status).toBe('completed');
      expect(result.translatedText).toBe('Good morning');
    });
  });

  describe('generateSummary() - единый контракт /summary', () => {
    it('отправляет текст голосового сообщения через контракт messages и возвращает summary', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { summary: 'Краткая сводка', decisions: [], participants: ['voice'], language: 'ru', provider: 'lmstudio' } }),
      );

      const result = await service.generateSummary('  Обсудили сроки проекта.  ');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8000/summary',
        {
          messages: [{ sender_id: 'voice', text: 'Обсудили сроки проекта.' }],
          language: 'ru',
        },
        expect.objectContaining({ timeout: 120000 }),
      );
      expect(result).toEqual({ summary: 'Краткая сводка', status: 'completed' });
    });
  });

  it('gives real Whisper enough configurable time and parses its transcript', async () => {
    mockHttpService.post.mockReturnValueOnce(
      of({ data: { transcript: 'Распознано', recognized_text: 'Распознано', language: 'ru', provider: 'openai_compatible' } }),
    );

    const result = await service.transcribeAudio(
      Buffer.from('audio'),
      'voice.webm',
      'audio/webm',
      'ru',
    );

    expect(mockHttpService.post).toHaveBeenCalledWith(
      'http://localhost:8000/stt',
      expect.any(FormData),
      expect.objectContaining({ timeout: 120000 }),
    );
    expect(result).toEqual({
      transcript: 'Распознано',
      summary: undefined,
      language: 'ru',
      status: 'completed',
      provider: 'openai_compatible',
    });
  });

  it('preserves Whisper timeout details after the bounded retry', async () => {
    const timeout = Object.assign(new Error('timeout of 120000ms exceeded'), {
      code: 'ECONNABORTED',
    });
    mockHttpService.post.mockImplementation(() => throwError(() => timeout));

    const result = await service.transcribeAudio(
      Buffer.from('audio'),
      'voice.wav',
      'audio/wav',
      'ru',
    );

    expect(result).toMatchObject({
      status: 'failed',
      error: 'timeout of 120000ms exceeded',
    });
    expect(mockHttpService.post).toHaveBeenCalledTimes(2);
  });
});
