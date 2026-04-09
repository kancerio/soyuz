import { Injectable, NotFoundException } from '@nestjs/common';
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
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (message.userId !== userId) {
      throw new NotFoundException('Вы можете редактировать только свои сообщения');
    }

    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();

    return this.messagesRepository.save(message);
  }

  async deleteMessage(messageId: number, userId: number): Promise<{ deleted: boolean }> {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (message.userId !== userId) {
      throw new NotFoundException('Вы можете удалять только свои сообщения');
    }

    message.isDeleted = true;
    message.content = '[Сообщение удалено]';
    await this.messagesRepository.save(message);

    return { deleted: true };
  }

  async getMessage(id: number): Promise<Message> {
    const message = await this.messagesRepository.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }
    return message;
  }
}