import { Test, TestingModule } from '@nestjs/testing';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

describe('ChatsController', () => {
  let controller: ChatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [
        {
          provide: ChatsService,
          useValue: {
            getUserChats: jest.fn(),
            findOne: jest.fn(),
            createPrivateChat: jest.fn(),
            createGroupChat: jest.fn(),
            addParticipant: jest.fn(),
            removeParticipant: jest.fn(),
            updateParticipantRole: jest.fn(),
            getUserRole: jest.fn(),
            isParticipant: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatsController>(ChatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
