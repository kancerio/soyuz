import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Message } from './message.entity';
import { UsersService } from '../users/users.service';
import { ChatsService } from '../chats/chats.service';
import { TranslationService, AssistResult } from '../translation/translation.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ChatsService))
    private chatsService: ChatsService,
    private translationService: TranslationService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getChatMessages(chatId: number, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.messagesRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
      relations: ['user'],
    });
  }

  async sendMessage(
    chatId: number,
    userId: number,
    content: string,
    sourceLang: string = 'auto',
    targetLang?: string,
  ): Promise<Message> {
    return this.sendMessageWithTranslation(chatId, userId, content, sourceLang, targetLang);
  }

  async sendMessageWithTranslation(
    chatId: number,
    userId: number,
    content: string,
    sourceLang: string = 'auto',
    targetLang?: string,
  ): Promise<Message> {
    // 1. Проверяем участие в чате (единый источник истины)
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не являетесь участником этого чата');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // 2. Определяем корректный targetLang
    let resolvedTargetLang = targetLang;
    if (!resolvedTargetLang || resolvedTargetLang === 'auto') {
      const members = await this.chatsService.getChatMembers(chatId);
      const otherMember = members.find((m) => m.userId !== userId);
      resolvedTargetLang = otherMember?.user?.preferred_language || 'en';
    }

    // 3. Сохраняем оригинал сообщения
    const message = this.messagesRepository.create({
      content,
      originalText: content,
      sourceLang: sourceLang || 'auto',
      targetLang: resolvedTargetLang,
      userId,
      chatId,
      translateStatus: 'pending',
      isDelivered: true,
    });

    const saved = await this.messagesRepository.save(message);

    const fullMessage = (await this.messagesRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    })) || saved;

    // 4. Отправляем единое событие создания сообщения для realtime-рассылки в WebSocket
    this.eventEmitter.emit('message.created', fullMessage);

    // 5. Запускаем перевод в фоне (ошибка AI не ломает сообщение)
    this.translateInBackground(saved.id, content, sourceLang || 'auto', resolvedTargetLang);

    // 6. Сразу возвращаем созданное сообщение
    return fullMessage;
  }

  private async translateInBackground(
    messageId: number,
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<void> {
    try {
      const result = await this.translationService.translate(text, sourceLang, targetLang);

      const message = await this.messagesRepository.findOne({
        where: { id: messageId },
      });

      if (!message) return;

      message.translatedText = result.translatedText;
      message.sourceLang = result.sourceLang;
      message.targetLang = result.targetLang;
      message.translateStatus = result.status === 'completed' ? 'completed' : 'failed';

      await this.messagesRepository.save(message);

      // Отправляем событие для WebSocket
      this.eventEmitter.emit('message.translated', {
        messageId: message.id,
        chatId: message.chatId,
        translatedText: message.translatedText,
        translateStatus: message.translateStatus,
      });
    } catch (error) {
      // При ошибке перевода — оригинал всё равно сохранён
      const message = await this.messagesRepository.findOne({
        where: { id: messageId },
      });

      await this.messagesRepository.update(messageId, {
        translateStatus: 'failed',
      });

      this.eventEmitter.emit('message.translated', {
        messageId,
        chatId: message?.chatId || 0,
        translatedText: '',
        translateStatus: 'failed',
      });
    }
  }

  async assist(
  text: string,
  action: 'shorten' | 'formal' | 'friendly',
): Promise<AssistResult> {
  return this.translationService.assist(text, action);
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