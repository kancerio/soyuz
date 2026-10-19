import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
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
  });
});
