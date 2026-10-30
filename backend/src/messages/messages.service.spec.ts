import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException, BadGatewayException, GatewayTimeoutException } from '@nestjs/common';

jest.mock('@nestjs/event-emitter', () => {
  class MockEventEmitter2 {
    emit = jest.fn();
  }
  return {
    EventEmitter2: MockEventEmitter2,
    OnEvent: () => () => {},
  };
});
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagesService } from './messages.service';
import { Message } from './message.entity';
import { UsersService } from '../users/users.service';
import { ChatsService } from '../chats/chats.service';
import { TranslationService } from '../translation/translation.service';

describe('MessagesService - Unified Message Pipeline (Задача 1)', () => {
  let service: MessagesService;
  let mockMessagesRepository: any;
  let mockUsersService: any;
  let mockChatsService: any;
  let mockTranslationService: any;
  let mockEventEmitter: any;

  beforeEach(async () => {
    mockMessagesRepository = {
      create: jest.fn().mockImplementation((dto) => ({ id: 101, ...dto })),
      save: jest.fn().mockImplementation((msg) => Promise.resolve({ id: 101, ...msg })),
      findOne: jest.fn().mockImplementation(() =>
        Promise.resolve({
          id: 101,
          content: 'Привет мир',
          chatId: 1,
          userId: 10,
          targetLang: 'ru',
          user: { id: 10, username: 'alice' },
        }),
      ),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockUsersService = {
      findOne: jest.fn().mockResolvedValue({ id: 10, username: 'alice', preferred_language: 'en' }),
    };

    mockChatsService = {
      isParticipant: jest.fn().mockImplementation(async (chatId, userId) => {
        return userId === 10 || userId === 20; // 10 и 20 в чате
      }),
      getChatMembers: jest.fn().mockResolvedValue([
        { userId: 10, user: { id: 10, preferred_language: 'en' } },
        { userId: 20, user: { id: 20, preferred_language: 'ru' } },
      ]),
    };

    mockTranslationService = {
      translate: jest.fn().mockResolvedValue({
        originalText: 'Привет',
        translatedText: 'Hello',
        sourceLang: 'ru',
        targetLang: 'en',
        status: 'completed',
        mock: false,
      }),
      assist: jest.fn().mockResolvedValue({
        originalText: 'Черновик',
        resultText: 'Улучшенный текст',
        action: 'friendly',
        status: 'completed',
        mock: false,
      }),
      summarizeMessages: jest.fn().mockResolvedValue({
        summary: 'Итог',
        decisions: [],
        participants: ['1'],
        language: 'ru',
        provider: 'lmstudio',
        status: 'completed',
      }),
      transcribeAudio: jest.fn().mockResolvedValue({
        transcript: 'Распознанный голос',
        summary: 'Краткое резюме',
        language: 'ru',
        status: 'completed',
      }),
      generateSummary: jest.fn().mockResolvedValue({
        summary: 'Краткое резюме',
        status: 'completed',
      }),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessagesRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ChatsService,
          useValue: mockChatsService,
        },
        {
          provide: TranslationService,
          useValue: mockTranslationService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('должен блокировать отправку, если пользователь не является участником чата', async () => {
    await expect(
      service.sendMessageWithTranslation(1, 999, 'Привет'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('должен автоматически определить targetLang по языку собеседника в чате', async () => {
    // Отправитель - userId: 10 (en), собеседник - userId: 20 (ru)
    const result = await service.sendMessageWithTranslation(1, 10, 'Hello');

    expect(mockMessagesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello',
        targetLang: 'ru', // выбран язык собеседника (userId: 20)
        translateStatus: 'pending',
      }),
    );
  });

  it('должен использовать явно переданный targetLang, если он указан', async () => {
    await service.sendMessageWithTranslation(1, 10, 'Hello', 'en', 'es');

    expect(mockMessagesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello',
        targetLang: 'es',
      }),
    );
  });

  it('должен генерировать событие message.created для единого realtime вещания', async () => {
    await service.sendMessageWithTranslation(1, 10, 'Тестовое сообщение');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'message.created',
      expect.objectContaining({
        id: 101,
      }),
    );
  });

  describe('AI requests routed through backend', () => {
    it('returns the translation result', async () => {
      await expect(service.translateText('Привет', 'ru', 'en')).resolves.toMatchObject({
        translatedText: 'Hello',
        status: 'completed',
      });
      expect(mockTranslationService.translate).toHaveBeenCalledWith('Привет', 'ru', 'en');
    });

    it('uses the structured summary contract for chat messages', async () => {
      const messages = [{ sender_id: '1', text: 'Обсудили сроки' }];

      await expect(service.summarizeMessages(messages, 'ru')).resolves.toMatchObject({
        summary: 'Итог',
        provider: 'lmstudio',
      });
      expect(mockTranslationService.summarizeMessages).toHaveBeenCalledWith(messages, 'ru');
    });

    it('maps summary provider failure to a gateway error', async () => {
      mockTranslationService.summarizeMessages.mockResolvedValueOnce({
        summary: '',
        status: 'failed',
      });

      await expect(service.summarizeMessages([{ sender_id: '1', text: 'Текст' }], 'ru'))
        .rejects.toBeInstanceOf(BadGatewayException);
    });

    it('maps local Whisper timeout to HTTP gateway timeout', async () => {
      mockTranslationService.transcribeAudio.mockResolvedValueOnce({
        transcript: '',
        language: 'ru',
        status: 'failed',
        error: 'Speech provider timed out',
      });

      await expect(
        service.transcribeAudio(
          { buffer: Buffer.from('audio'), originalname: 'voice.wav', mimetype: 'audio/wav' } as any,
          'ru',
        ),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });
  });

  describe('Voice Messages (Задача 2)', () => {
    const validAudioFile: any = {
      buffer: Buffer.from('FAKE_AUDIO_DATA_FOR_TESTING'),
      mimetype: 'audio/webm',
      size: 28,
      originalname: 'voice.webm',
    };

    it('должен отклонять отправку голосового, если пользователь не участник чата', async () => {
      await expect(
        service.sendVoiceMessage(1, 999, validAudioFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('должен отклонять недопустимый MIME-тип (например, application/pdf)', async () => {
      const invalidFile: any = {
        ...validAudioFile,
        mimetype: 'application/pdf',
      };
      await expect(
        service.sendVoiceMessage(1, 10, invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('должен отклонять файл размером более 20 МБ', async () => {
      const hugeFile: any = {
        ...validAudioFile,
        size: 25 * 1024 * 1024,
      };
      await expect(
        service.sendVoiceMessage(1, 10, hugeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('должен отклонять файл с неверной сигнатурой magic bytes', async () => {
      const corruptFile: any = {
        ...validAudioFile,
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
      };
      await expect(
        service.sendVoiceMessage(1, 10, corruptFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('должен успешно сохранять голосовое сообщение с безопасным voiceFileId и рассылать message.created', async () => {
      const result = await service.sendVoiceMessage(1, 10, validAudioFile, 12);

      expect(mockMessagesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '[Голосовое сообщение]',
          voiceMimeType: 'audio/webm',
          voiceSize: 28,
          voiceDuration: 12,
          sttStatus: 'pending',
          summaryStatus: 'pending',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'message.created',
        expect.anything(),
      );
    });

    it('должен блокировать получение голосового файла, если пользователь не в чате', async () => {
      mockMessagesRepository.findOne.mockResolvedValueOnce({
        id: 101,
        chatId: 1,
        voiceFileId: 'secret-uuid-123',
        voiceMimeType: 'audio/webm',
      });

      await expect(
        service.getVoiceFile('secret-uuid-123', 999), // 999 не в чате
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Безопасное фоновое обновление сообщения (Задача 4)', () => {
    it('должен обновлять transcript, sttStatus, voiceSummary и summaryStatus при успехе AI', async () => {
      const mockMsg = {
        id: 101,
        chatId: 1,
        content: '[Голосовое сообщение]',
        sttStatus: 'pending',
        summaryStatus: 'pending',
      };
      mockMessagesRepository.findOne.mockResolvedValue(mockMsg);

      // Временный тестовый файл
      const fs = require('fs');
      const path = require('path');
      const tmpFile = path.join(process.cwd(), 'temp_test_audio.webm');
      fs.writeFileSync(tmpFile, 'FAKE_AUDIO');

      try {
        await service.processVoiceInBackground(101, tmpFile, 'audio/webm', 'ru');

        expect(mockMessagesRepository.update).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            transcript: 'Распознанный голос',
            sttStatus: 'completed',
          }),
        );
        expect(mockMessagesRepository.update).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            voiceSummary: 'Краткое резюме',
            summaryStatus: 'completed',
          }),
        );
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'message.transcribed',
          expect.objectContaining({
            messageId: 101,
            transcript: 'Распознанный голос',
            transcriptStatus: 'completed',
          }),
        );
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'message.voice_summary',
          expect.objectContaining({
            messageId: 101,
            summary: 'Краткое резюме',
            summaryStatus: 'completed',
          }),
        );
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it('при ошибке STT должен безопасно выставлять failed и не ломать сообщение', async () => {
      mockTranslationService.transcribeAudio.mockResolvedValueOnce({
        transcript: '',
        language: 'ru',
        status: 'failed',
      });

      const fs = require('fs');
      const path = require('path');
      const tmpFile = path.join(process.cwd(), 'temp_test_audio_fail.webm');
      fs.writeFileSync(tmpFile, 'FAKE_AUDIO');

      try {
        await service.processVoiceInBackground(101, tmpFile, 'audio/webm', 'ru');

        expect(mockMessagesRepository.update).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            sttStatus: 'failed',
            summaryStatus: 'failed',
          }),
        );
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'message.transcribed',
          expect.objectContaining({
            messageId: 101,
            transcriptStatus: 'failed',
          }),
        );
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it('при ошибке Summary transcript должен сохраняться, а summaryStatus становиться failed', async () => {
      mockTranslationService.transcribeAudio.mockResolvedValueOnce({
        transcript: 'Транскрипт готов',
        summary: undefined,
        language: 'ru',
        status: 'completed',
      });
      mockTranslationService.generateSummary.mockResolvedValueOnce({
        summary: '',
        status: 'failed',
      });

      const fs = require('fs');
      const path = require('path');
      const tmpFile = path.join(process.cwd(), 'temp_test_summary_fail.webm');
      fs.writeFileSync(tmpFile, 'FAKE_AUDIO');

      try {
        await service.processVoiceInBackground(101, tmpFile, 'audio/webm', 'ru');

        expect(mockMessagesRepository.update).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            transcript: 'Транскрипт готов',
            sttStatus: 'completed',
          }),
        );
        expect(mockMessagesRepository.update).toHaveBeenCalledWith(
          101,
          expect.objectContaining({
            summaryStatus: 'failed',
          }),
        );
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });
  });
});
