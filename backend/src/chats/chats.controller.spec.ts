import { Test, TestingModule } from '@nestjs/testing';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

describe('ChatsController', () => {
  let controller: ChatsController;
  let chatsServiceMock: any;

  beforeEach(async () => {
    chatsServiceMock = {
      getUserChats: jest.fn(),
      findOne: jest.fn(),
      createPrivateChat: jest.fn(),
      createGroupChat: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      updateParticipantRole: jest.fn(),
      getUserRole: jest.fn(),
      isParticipant: jest.fn(),
      getChatMembers: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [
        {
          provide: ChatsService,
          useValue: chatsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ChatsController>(ChatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns usernames and roles in the group members response', async () => {
    chatsServiceMock.isParticipant.mockResolvedValue(true);
    chatsServiceMock.getChatMembers.mockResolvedValue([
      { userId: 12, role: 'admin', user: { username: 'alice' } },
    ]);

    await expect(
      controller.getChatMembers('7', { user: { userId: 1 } }),
    ).resolves.toEqual([{ userId: 12, username: 'alice', role: 'admin' }]);
  });

  it('denies the members list to non-participants', async () => {
    chatsServiceMock.isParticipant.mockResolvedValue(false);

    await expect(
      controller.getChatMembers('7', { user: { userId: 1 } }),
    ).rejects.toThrow();
    expect(chatsServiceMock.getChatMembers).not.toHaveBeenCalled();
  });

  it('removeMember passes the actor id to the service', async () => {
    chatsServiceMock.removeParticipant.mockResolvedValue(undefined);

    await expect(
      controller.removeMember('7', '12', { user: { userId: 1 } }),
    ).resolves.toEqual({ message: 'Участник исключён' });
    expect(chatsServiceMock.removeParticipant).toHaveBeenCalledWith(7, 12, 1);
  });
});
