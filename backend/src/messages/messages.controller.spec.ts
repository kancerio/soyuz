import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ChatsService } from '../chats/chats.service';

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            getChatMessages: jest.fn(),
            sendMessageWithTranslation: jest.fn(),
            sendVoiceMessage: jest.fn(),
            getVoiceFile: jest.fn(),
            assist: jest.fn(),
            editMessage: jest.fn(),
            deleteMessage: jest.fn(),
            getChatSummary: jest.fn(),
          },
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
  describe('getChatSummary', () => {
    it('должен передавать userId и limit в messagesService.getChatSummary', async () => {
      const mockReq = { user: { userId: 42 } };
      await controller.getChatSummary(mockReq, '7', '15');

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
