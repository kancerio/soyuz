import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ChatsService } from '../chats/chats.service';
import { TranslateDto } from './dto/translate.dto';
import { SummaryDto } from './dto/summary.dto';

describe('MessagesController', () => {
  let controller: MessagesController;
  let messagesService: Record<string, jest.Mock>;

  beforeEach(async () => {
    messagesService = {
      getChatMessages: jest.fn(),
      sendMessageWithTranslation: jest.fn(),
      sendVoiceMessage: jest.fn(),
      getVoiceFile: jest.fn(),
      assist: jest.fn(),
      translateText: jest.fn(),
      summarizeMessages: jest.fn(),
      transcribeAudio: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      getChatSummary: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: messagesService,
        },
        {
          provide: ChatsService,
          useValue: {
            getUserRole: jest.fn(),
            isParticipant: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getChatMessages', () => {
    it('должен передавать userId из req.user в сервис для проверки прав доступа', async () => {
      const mockReq = { user: { userId: 42 } };
      await controller.getChatMessages(mockReq, '7', '20', '10');

      expect((controller as any).messagesService.getChatMessages).toHaveBeenCalledWith(
        7,
        42,
        20,
        10,
      );
    });
  });

  describe('translate', () => {
    it('должен вызывать translateText с корректными параметрами из TranslateDto', async () => {
      const dto: TranslateDto = {
        text: 'Привет',
        source_lang: 'ru',
        target_lang: 'en',
      };
      messagesService.translateText.mockResolvedValueOnce({
        originalText: 'Привет',
        translatedText: 'Hello',
        sourceLang: 'ru',
        targetLang: 'en',
        status: 'completed',
        mock: false,
      });

      const result = await controller.translate(dto);
      expect(messagesService.translateText).toHaveBeenCalledWith('Привет', 'ru', 'en');
      expect(result).toHaveProperty('translatedText', 'Hello');
    });
  });

  describe('summarize', () => {
    it('должен вызывать summarizeMessages с корректными параметрами из SummaryDto', async () => {
      const dto: SummaryDto = {
        messages: [{ sender_id: 'user1', text: 'Обсуждение' }],
        language: 'ru',
      };
      messagesService.summarizeMessages.mockResolvedValueOnce({
        summary: 'Краткая суть',
        decisions: [],
        participants: [],
        language: 'ru',
        provider: 'ai',
        status: 'completed',
      });

      const result = await controller.summarize(dto);
      expect(messagesService.summarizeMessages).toHaveBeenCalledWith(dto.messages, 'ru');
      expect(result).toHaveProperty('summary', 'Краткая суть');
    });
  });

  describe('getChatSummary', () => {
    it('должен передавать userId и limit в messagesService.getChatSummary', async () => {
      const mockReq = { user: { userId: 42 } };
      await controller.getChatSummary(mockReq, '7', { limit: 15 });

      expect((controller as any).messagesService.getChatSummary).toHaveBeenCalledWith(
        7,
        42,
        15,
      );
    });

    it('должен использовать дефолтный limit 20, если limit не передан', async () => {
      const mockReq = { user: { userId: 42 } };
      await controller.getChatSummary(mockReq, '7');

      expect((controller as any).messagesService.getChatSummary).toHaveBeenCalledWith(
        7,
        42,
        20,
      );
    });
  });
});
