import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
});
