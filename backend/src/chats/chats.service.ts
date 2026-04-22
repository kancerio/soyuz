import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private chatsRepository: Repository<Chat>,
    private usersService: UsersService,
  ) {}

  // Получить все чаты пользователя
  async getUserChats(userId: number): Promise<Chat[]> {
    return this.chatsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Получить чат по ID
  async findOne(id: number): Promise<Chat | null> {
    return this.chatsRepository.findOne({
      where: { id },
    });
  }

  // Создать личный чат
  async createPrivateChat(userId1: number, userId2: number): Promise<Chat> {
    const user1 = await this.usersService.findOne(userId1);
    const user2 = await this.usersService.findOne(userId2);

    if (!user1 || !user2) {
      throw new NotFoundException('Пользователь не найден');
    }

    const chat = this.chatsRepository.create({
      isGroup: false,
      title: null,
    });

    return this.chatsRepository.save(chat);
  }

  // Создать групповой чат
  async createGroupChat(title: string, creatorId: number, participantIds: number[]): Promise<Chat> {
    const chat = this.chatsRepository.create({
      title: title,
      isGroup: true,
    });

    return this.chatsRepository.save(chat);
  }

  // Добавить участника в чат (упрощённо)
  async addParticipant(chatId: number, userId: number): Promise<Chat> {
    const chat = await this.findOne(chatId);
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }
    return chat;
  }
}