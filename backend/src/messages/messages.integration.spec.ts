import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

describe('Интеграционные тесты (Задача 6)', () => {
  let service: MessagesService;
  let eventEmitter: EventEmitter2;
  let messagesDb: Map<number, Message>;
  let idCounter: number;

  let mockUsersService: any;
  let mockChatsService: any;
  let mockTranslationService: any;

  beforeEach(async () => {
    messagesDb = new Map<number, Message>();
    idCounter = 1;

    const mockMessagesRepository = {
      create: jest.fn().mockImplementation((dto) => {
        const id = idCounter++;
        return { id, createdAt: new Date(), ...dto };
      }),
      save: jest.fn().mockImplementation(async (msg) => {
        messagesDb.set(msg.id, { ...msg });
        return { ...msg };
      }),
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id) return messagesDb.get(where.id) || null;
        if (where.voiceFileId) {
          for (const msg of messagesDb.values()) {
            if (msg.voiceFileId === where.voiceFileId) return msg;
          }
        }
        return null;
      }),
      find: jest.fn().mockImplementation(async ({ where }) => {
        const result: Message[] = [];
        for (const msg of messagesDb.values()) {
          if (msg.chatId === where.chatId) {
            result.push({ ...msg });
          }
        }
        return result;
      }),
      update: jest.fn().mockImplementation(async (id, updateDto) => {
        const existing = messagesDb.get(id);
        if (existing) {
          Object.assign(existing, updateDto);
        }
        return { affected: existing ? 1 : 0 };
      }),
    };

    mockUsersService = {
      findOne: jest.fn().mockImplementation(async (id: number) => {
        if (id === 1) return { id: 1, username: 'user1', preferred_language: 'ru' };
        if (id === 2) return { id: 2, username: 'user2', preferred_language: 'en' };
        return null;
      }),
    };

    mockChatsService = {
      isParticipant: jest.fn().mockImplementation(async (chatId: number, userId: number) => {
        return (userId === 1 || userId === 2) && chatId === 10;
      }),
      getChatMembers: jest.fn().mockImplementation(async (chatId: number) => {
        return [
          { userId: 1, user: { id: 1, preferred_language: 'ru' } },
          { userId: 2, user: { id: 2, preferred_language: 'en' } },
        ];
      }),
    };

    mockTranslationService = {
      translate: jest.fn(),
      transcribeAudio: jest.fn(),
      generateSummary: jest.fn(),
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
          useClass: EventEmitter2,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('Поток text → translation и повторное открытие истории', () => {
    it('успешный перевод: text сохраняется, переводится в фоне, доступен при открытии истории', async () => {
      mockTranslationService.translate.mockResolvedValueOnce({
        originalText: 'Привет, мир',
        translatedText: 'Hello, world',
        sourceLang: 'ru',
        targetLang: 'en',
        status: 'completed',
        mock: false,
      });

      // 1. Отправка сообщения
      const sentMessage = await service.sendMessageWithTranslation(
        10, // chatId
        1,  // userId
        'Привет, мир',
      );

      expect(sentMessage.content).toBe('Привет, мир');
      expect(sentMessage.targetLang).toBe('en'); // определено по собеседнику
      expect(sentMessage.translateStatus).toBe('pending');
      expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', expect.any(Object));

      // Ждём завершения фонового перевода
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.translated',
        expect.objectContaining({
          messageId: sentMessage.id,
          chatId: 10,
          translatedText: 'Hello, world',
          translateStatus: 'completed',
        }),
      );

      // 2. Повторное открытие истории чата
      const history = await service.getChatMessages(10, 1);
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        id: sentMessage.id,
        content: 'Привет, мир',
        originalText: 'Привет, мир',
        translatedText: 'Hello, world',
        targetLang: 'en',
        translateStatus: 'completed',
      });
    });

    it('сбой AI (503 / timeout): сообщение сохраняется, статус failed, доступно в истории', async () => {
      mockTranslationService.translate.mockRejectedValueOnce(
        new Error('AI Service 503 Service Unavailable / Timeout'),
      );

      // 1. Отправка сообщения
      const sentMessage = await service.sendMessageWithTranslation(
        10,
        1,
        'Важное сообщение при сбое ИИ',
      );

      expect(sentMessage.content).toBe('Важное сообщение при сбое ИИ');

      // Ждём фоновую обработку
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Проверяем, что событие ошибки отправлено
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.translated',
        expect.objectContaining({
          messageId: sentMessage.id,
          translateStatus: 'failed',
        }),
      );

            // 2. Повторное открытие истории чата: сообщение НЕ сломано и доступно
      const history = await service.getChatMessages(10, 1);
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        id: sentMessage.id,
        content: 'Важное сообщение при сбое ИИ',
        translateStatus: 'failed',
      });

      // 3. Негативный тест: посторонний пользователь (userId: 999) блокируется при чтении истории
      await expect(
        service.getChatMessages(10, 999),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Поток voice → STT → summary и повторное открытие истории', () => {
    let tmpVoiceDir: string;
    let tmpVoiceFile: string;

    beforeEach(() => {
      tmpVoiceDir = path.join(process.cwd(), 'uploads', 'voice');
      if (!fs.existsSync(tmpVoiceDir)) {
        fs.mkdirSync(tmpVoiceDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (tmpVoiceFile && fs.existsSync(tmpVoiceFile)) {
        try { fs.unlinkSync(tmpVoiceFile); } catch (e) {}
      }
    });

    it('успешный поток voice → STT → summary и проверка доступа участников', async () => {
      mockTranslationService.transcribeAudio.mockResolvedValueOnce({
        transcript: 'Распознанный голос интеграционного теста',
        summary: undefined,
        language: 'ru',
        status: 'completed',
      });

      mockTranslationService.generateSummary.mockResolvedValueOnce({
        summary: 'Краткое содержание голосового',
        status: 'completed',
      });

      const audioBuffer = Buffer.from('RIFF_MOCK_WAV_AUDIO_STREAM_DATA');
      const mockFile: any = {
        buffer: audioBuffer,
        size: audioBuffer.length,
        mimetype: 'audio/wav',
        originalname: 'voice.wav',
      };

      // 1. Отправка голосового сообщения
      const voiceMessage = await service.sendVoiceMessage(10, 1, mockFile, 15);
      expect(voiceMessage.voiceFileId).toBeDefined();
      expect(voiceMessage.sttStatus).toBe('pending');
      expect(voiceMessage.summaryStatus).toBe('pending');
      expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', expect.any(Object));

      // Ждём фоновую обработку STT и summary
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Проверяем события для сокетов
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.transcribed',
        expect.objectContaining({
          messageId: voiceMessage.id,
          transcript: 'Распознанный голос интеграционного теста',
          sttStatus: 'completed',
        }),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.voice_summary',
        expect.objectContaining({
          messageId: voiceMessage.id,
          voiceSummary: 'Краткое содержание голосового',
          summaryStatus: 'completed',
        }),
      );

      // 2. Повторное открытие истории чата
      const history = await service.getChatMessages(10, 1);
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        id: voiceMessage.id,
        voiceFileId: voiceMessage.voiceFileId,
        transcript: 'Распознанный голос интеграционного теста',
        sttStatus: 'completed',
        voiceSummary: 'Краткое содержание голосового',
        summaryStatus: 'completed',
      });

      // 3. Получение файла: участник чата (userId: 2) получает файл
      const fileResult = await service.getVoiceFile(voiceMessage.voiceFileId!, 2);
      expect(fileResult.filePath).toBeDefined();
      expect(fs.existsSync(fileResult.filePath)).toBe(true);

      // Запоминаем для очистки
      tmpVoiceFile = fileResult.filePath;

      // 4. Посторонний пользователь (userId: 999) блокируется с 403
      await expect(
        service.getVoiceFile(voiceMessage.voiceFileId!, 999),
      ).rejects.toThrow(ForbiddenException);
    });

    it('сбой STT/Summary (timeout / 503): аудиофайл и сообщение целы, статус failed, доступно в истории', async () => {
      mockTranslationService.transcribeAudio.mockRejectedValueOnce(
        new Error('STT Service Timeout / 503 Service Unavailable'),
      );

      const audioBuffer = Buffer.from('AUDIO_BYTES_FAIL_SCENARIO');
      const mockFile: any = {
        buffer: audioBuffer,
        size: audioBuffer.length,
        mimetype: 'audio/webm',
        originalname: 'voice.webm',
      };

      // 1. Отправка
      const voiceMessage = await service.sendVoiceMessage(10, 1, mockFile, 8);

      // Ждём фоновую обработку со сбоем
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.transcribed',
        expect.objectContaining({
          messageId: voiceMessage.id,
          sttStatus: 'failed',
        }),
      );

      // 2. Повторное открытие истории: сообщение цело и доступно
      const history = await service.getChatMessages(10, 1);
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        id: voiceMessage.id,
        voiceFileId: voiceMessage.voiceFileId,
        sttStatus: 'failed',
        summaryStatus: 'failed',
      });

      // 3. Аудиофайл по-прежнему доступен для прослушивания участниками
      const fileResult = await service.getVoiceFile(voiceMessage.voiceFileId!, 1);
      expect(fileResult.filePath).toBeDefined();
      expect(fs.existsSync(fileResult.filePath)).toBe(true);
      tmpVoiceFile = fileResult.filePath;
    });
  });
});
