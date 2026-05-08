import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { ChatParticipant } from './chat-participant.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private chatsRepository: Repository<Chat>,
    @InjectRepository(ChatParticipant)
    private chatParticipantsRepository: Repository<ChatParticipant>,
    private usersService: UsersService,
  ) {}

  // Получить все чаты пользователя
  async getUserChats(userId: number): Promise<Chat[]> {
    const participants = await this.chatParticipantsRepository.find({
      where: { userId },
      relations: ['chat'],
    });
    return participants.map(p => p.chat);
  }

  // Получить чат по ID
  async findOne(id: number): Promise<Chat | null> {
    return this.chatsRepository.findOne({
      where: { id },
      relations: ['participants', 'participants.user'],
    });
  }

  // Получить участников чата с ролями
  async getChatMembers(chatId: number): Promise<ChatParticipant[]> {
    return this.chatParticipantsRepository.find({
      where: { chatId },
      relations: ['user'],
    });
  }

  // Получить роль пользователя в чате
  async getUserRole(chatId: number, userId: number): Promise<string | null> {
    const participant = await this.chatParticipantsRepository.findOne({
      where: { chatId, userId },
    });
    return participant ? participant.role : null;
  }

  // Проверить, является ли пользователь участником чата
  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const count = await this.chatParticipantsRepository.count({
      where: { chatId, userId },
    });
    return count > 0;
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

    const savedChat = await this.chatsRepository.save(chat);

    await this.chatParticipantsRepository.save([
      { chatId: savedChat.id, userId: userId1, role: 'member' },
      { chatId: savedChat.id, userId: userId2, role: 'member' },
    ]);

    return savedChat;
  }

  // Создать групповой чат
  async createGroupChat(title: string, creatorId: number, participantIds: number[]): Promise<Chat> {
    const creator = await this.usersService.findOne(creatorId);
    if (!creator) {
      throw new NotFoundException('Создатель чата не найден');
    }

    const chat = this.chatsRepository.create({
      title,
      isGroup: true,
    });

    const savedChat = await this.chatsRepository.save(chat);

    const participants = [
      { chatId: savedChat.id, userId: creatorId, role: 'owner' as const },
      ...participantIds.map(userId => ({
        chatId: savedChat.id,
        userId,
        role: 'member' as const,
      })),
    ];

    await this.chatParticipantsRepository.save(participants);

    return savedChat;
  }

  // Добавить участника
  async addParticipant(chatId: number, userId: number): Promise<ChatParticipant> {
    const chat = await this.findOne(chatId);
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const isAlreadyParticipant = await this.isParticipant(chatId, userId);
    if (isAlreadyParticipant) {
      throw new ForbiddenException('Пользователь уже является участником чата');
    }

    const participant = this.chatParticipantsRepository.create({
      chatId,
      userId,
      role: 'member',
    });

    return this.chatParticipantsRepository.save(participant);
  }

  // Исключить участника (только owner/admin)
async removeParticipant(chatId: number, userId: number, actorId: number): Promise<void> {
  // Проверяем права удаляющего
  const actorRole = await this.getUserRole(chatId, actorId);
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new ForbiddenException('Недостаточно прав для исключения участников');
  }

  // Нельзя исключить владельца
  const targetRole = await this.getUserRole(chatId, userId);
  if (targetRole === 'owner') {
    throw new ForbiddenException('Нельзя исключить владельца чата');
  }

  // Проверяем, что пользователь является участником
  const isParticipant = await this.isParticipant(chatId, userId);
  if (!isParticipant) {
    throw new NotFoundException('Пользователь не является участником чата');
  }

  await this.chatParticipantsRepository.delete({ chatId, userId });
}

  // Выйти из чата самостоятельно
async leaveChat(chatId: number, userId: number): Promise<void> {
  // Проверяем, существует ли чат
  const chat = await this.findOne(chatId);
  if (!chat) {
    throw new NotFoundException('Чат не найден');
  }

  // Получаем роль пользователя
  const role = await this.getUserRole(chatId, userId);
  
  // Владелец не может выйти из чата
  if (role === 'owner') {
    throw new ForbiddenException('Владелец не может выйти из чата. Сначала передайте права владельца.');
  }

  // Проверяем, является ли пользователь участником
  const isParticipant = await this.isParticipant(chatId, userId);
  if (!isParticipant) {
    throw new NotFoundException('Вы не являетесь участником этого чата');
  }

  // Удаляем участника
  await this.chatParticipantsRepository.delete({ chatId, userId });
}

  // Изменить роль участника
  async changeRole(chatId: number, userId: number, newRole: string): Promise<ChatParticipant> {
    const participant = await this.chatParticipantsRepository.findOne({
      where: { chatId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Участник не найден');
    }

    participant.role = newRole as any;
    return this.chatParticipantsRepository.save(participant);
  }

  // Удалить чат
  async deleteChat(chatId: number): Promise<void> {
    await this.chatsRepository.delete(chatId);
  }

  // Обновить название чата
  async updateChatTitle(chatId: number, title: string): Promise<Chat> {
    const chat = await this.findOne(chatId);
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    chat.title = title;
    return this.chatsRepository.save(chat);
  }
}