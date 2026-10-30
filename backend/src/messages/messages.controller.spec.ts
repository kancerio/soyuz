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
});
