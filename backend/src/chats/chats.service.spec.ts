import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { Chat } from './chat.entity';
import { ChatParticipant } from './chat-participant.entity';
import { UsersService } from '../users/users.service';

describe('ChatsService', () => {
  let service: ChatsService;
  let chatsRepo: any;
  let participantsRepo: any;
  let usersService: any;

  beforeEach(async () => {
    chatsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    participantsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    usersService = {
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: getRepositoryToken(Chat), useValue: chatsRepo },
        { provide: getRepositoryToken(ChatParticipant), useValue: participantsRepo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<ChatsService>(ChatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPrivateChat', () => {
    const existingChat = { id: 7, isGroup: false, title: null };

    const mockPrivateChatLookup = (found: Chat | null) => {
      chatsRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(found),
      });
    };

    it('отклоняет диалог с самим собой', async () => {
      await expect(service.createPrivateChat(1, 1)).rejects.toThrow(BadRequestException);
      expect(usersService.findOne).not.toHaveBeenCalled();
    });

    it('возвращает существующий диалог вместо создания дубля', async () => {
      usersService.findOne.mockResolvedValue({ id: 1 });
      mockPrivateChatLookup(existingChat as Chat);

      const result = await service.createPrivateChat(1, 2);

      expect(result).toBe(existingChat);
      expect(chatsRepo.save).not.toHaveBeenCalled();
      expect(participantsRepo.save).not.toHaveBeenCalled();
    });

    it('создаёт новый диалог, если совпадений нет', async () => {
      usersService.findOne.mockResolvedValue({ id: 1 });
      mockPrivateChatLookup(null);
      chatsRepo.create.mockReturnValue({ isGroup: false, title: null });
      chatsRepo.save.mockResolvedValue({ id: 9 });
      participantsRepo.save.mockResolvedValue([]);

      const result = await service.createPrivateChat(1, 2);

      expect(result.id).toBe(9);
      expect(participantsRepo.save).toHaveBeenCalledWith([
        { chatId: 9, userId: 1, role: 'member' },
        { chatId: 9, userId: 2, role: 'member' },
      ]);
    });
  });
});
