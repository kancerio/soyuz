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
});
