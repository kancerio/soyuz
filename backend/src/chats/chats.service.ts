import { Injectable, NotFoundException, ForbiddenException, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { ChatParticipant } from './chat-participant.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ChatsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Chat)
    private chatsRepository: Repository<Chat>,
    @InjectRepository(ChatParticipant)
    private chatParticipantsRepository: Repository<ChatParticipant>,
    private usersService: UsersService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureInitialChats();
  }

  // Автоматический посев демо-чатов при старте (только по флагу SEED_DEMO_CHATS=true)
  async ensureInitialChats() {
    if (process.env.SEED_DEMO_CHATS !== 'true') return;

    try {
      const initialChats = [
        { title: 'Разработка', isGroup: true },
        { title: 'Анна Петрова', isGroup: false },
        { title: 'Общий чат', isGroup: true },
        { title: 'Дизайн команда', isGroup: true },
        { title: 'Маркетинг', isGroup: true },
        { title: 'Техподдержка', isGroup: false },
        { title: 'Путешествия', isGroup: false },
        { title: 'Новости Союза', isGroup: true },
      ];

      for (const def of initialChats) {
        const existing = await this.chatsRepository.findOne({
          where: { title: def.title, isGroup: def.isGroup },
        });
        if (!existing) {
          const chat = this.chatsRepository.create(def);
          await this.chatsRepository.save(chat);
        }
      }
    } catch (e) {
      console.warn('ensureInitialChats warning:', (e as any)?.message);
    }
  }

  // Получить все чаты пользователя
  async getUserChats(userId: number): Promise<Chat[]> {
    const participants = await this.chatParticipantsRepository.find({
      where: { userId },
      relations: ['chat'],
    });

    return participants
      .map((p) => p.chat)
      .filter(Boolean)
      .sort((a, b) => a.id - b.id);
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

  // Создать личный чат (без дублей: возвращает существующий диалог, если он уже есть)
  async createPrivateChat(userId1: number, userId2: number): Promise<Chat> {
    if (userId1 === userId2) {
      throw new BadRequestException('Нельзя создать диалог с самим собой');
    }

    const user1 = await this.usersService.findOne(userId1);
    const user2 = await this.usersService.findOne(userId2);

    if (!user1 || !user2) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Ищем существующий личный чат, где оба пользователя — участники
    const existing = await this.chatsRepository
      .createQueryBuilder('chat')
      .innerJoin(
        ChatParticipant,
        'p1',
        'p1.chat_id = chat.id AND p1.user_id = :u1',
        { u1: userId1 },
      )
      .innerJoin(
        ChatParticipant,
        'p2',
        'p2.chat_id = chat.id AND p2.user_id = :u2',
        { u2: userId2 },
      )
      .where('chat."isGroup" = :isGroup', { isGroup: false })
      .getOne();

    if (existing) {
      return existing;
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
      ...participantIds.map((userId) => ({
        chatId: savedChat.id,
        userId,
        role: 'member' as const,
      })),
    ];

    await this.chatParticipantsRepository.save(participants);

    return savedChat;
  }

  // Добавить участника (только owner/admin)
  async addParticipant(chatId: number, userId: number, actorId: number): Promise<ChatParticipant> {
    const chat = await this.findOne(chatId);
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    const actorRole = await this.getUserRole(chatId, actorId);
    if (actorRole !== 'owner' && actorRole !== 'admin') {
      throw new ForbiddenException('Недостаточно прав для добавления участников');
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
    const actorRole = await this.getUserRole(chatId, actorId);
    if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
      throw new ForbiddenException('Недостаточно прав для исключения участников');
    }

    const targetRole = await this.getUserRole(chatId, userId);
    if (targetRole === 'owner') {
      throw new ForbiddenException('Нельзя исключить владельца чата');
    }

    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new NotFoundException('Пользователь не является участником чата');
    }

    await this.chatParticipantsRepository.delete({ chatId, userId });
  }

  // Выйти из чата самостоятельно
  async leaveChat(chatId: number, userId: number): Promise<void> {
    const chat = await this.findOne(chatId);
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    const role = await this.getUserRole(chatId, userId);
    if (role === 'owner') {
      throw new ForbiddenException('Владелец не может выйти из чата. Сначала передайте права владельца.');
    }

    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new NotFoundException('Вы не являетесь участником этого чата');
    }

    await this.chatParticipantsRepository.delete({ chatId, userId });
  }

  // Изменить роль участника (только владелец чата)
  async changeRole(chatId: number, userId: number, newRole: string, actorId: number): Promise<ChatParticipant> {
    const actorRole = await this.getUserRole(chatId, actorId);
    if (actorRole !== 'owner') {
      throw new ForbiddenException('Изменять роли может только владелец чата');
    }

    if (!['owner', 'admin', 'member'].includes(newRole)) {
      throw new ForbiddenException('Недопустимая роль');
    }

    const participant = await this.chatParticipantsRepository.findOne({
      where: { chatId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Участник не найден');
    }

    participant.role = newRole as any;
    return this.chatParticipantsRepository.save(participant);
  }

  // Удалить чат (только владелец)
  async deleteChat(chatId: number, actorId: number): Promise<void> {
    const actorRole = await this.getUserRole(chatId, actorId);
    if (actorRole !== 'owner') {
      throw new ForbiddenException('Удалить чат может только владелец');
    }
    await this.chatsRepository.delete(chatId);
  }

  // Обновить название чата (owner/admin)
  async updateChatTitle(chatId: number, title: string, actorId: number): Promise<Chat> {
    const chat = await this.findOne(chatId);
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    const actorRole = await this.getUserRole(chatId, actorId);
    if (actorRole !== 'owner' && actorRole !== 'admin') {
      throw new ForbiddenException('Недостаточно прав для изменения названия');
    }

    chat.title = title;
    return this.chatsRepository.save(chat);
  }
}
