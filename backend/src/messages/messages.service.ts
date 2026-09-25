import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    private usersService: UsersService,
  ) {}

  async getChatMessages(chatId: number, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.messagesRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
    });
  }

  async sendMessage(chatId: number, userId: number, content: string): Promise<Message> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const message = this.messagesRepository.create({
      content,
      userId,
      chatId,
    });

    return this.messagesRepository.save(message);
  }

  async editMessage(messageId: number, userId: number, newContent: string): Promise<Message> {
    const message = await this.getMessage(messageId);

    if (message.userId !== userId) {
      throw new ForbiddenException('Вы можете редактировать только свои сообщения');
    }

    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();

    return this.messagesRepository.save(message);
  }

  async getMessage(id: number): Promise<Message> {
    const message = await this.messagesRepository.findOne({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    return message;
  }

  async deleteMessage(messageId: number, userId: number, userRole?: string): Promise<{ deleted: boolean }> {
    const message = await this.getMessage(messageId);

    const isAuthor = message.userId === userId;
    const canDeleteAny = userRole === 'owner' || userRole === 'admin';
    
    if (!isAuthor && !canDeleteAny) {
      throw new ForbiddenException('Вы можете удалять только свои сообщения');
    }

    message.isDeleted = true;
    message.content = '[Сообщение удалено]';
    await this.messagesRepository.save(message);

    return { deleted: true };
  }

  // ========== НОВЫЕ МЕТОДЫ ДЛЯ ПОДТВЕРЖДЕНИЯ ДОСТАВКИ ==========

  async markAsDelivered(messageId: number, userId: number): Promise<Message> {
    const message = await this.getMessage(messageId);
    
    message.isDelivered = true;
    return this.messagesRepository.save(message);
  }

  async markAsRead(messageId: number, userId: number): Promise<Message> {
    const message = await this.getMessage(messageId);
    
    message.isRead = true;
    message.readAt = new Date();
    return this.messagesRepository.save(message);
  }

  async getUndeliveredMessages(chatId: number, userId: number): Promise<Message[]> {
    return this.messagesRepository.find({
      where: {
        chatId,
        isDelivered: false,
      },
      relations: ['user'],
    });
  }
}