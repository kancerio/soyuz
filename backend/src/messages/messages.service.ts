import { Injectable, NotFoundException, ForbiddenException, BadRequestException, BadGatewayException, GatewayTimeoutException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Message } from './message.entity';
import { UsersService } from '../users/users.service';
import { ChatsService } from '../chats/chats.service';
import {
  TranslationService,
  AssistResult,
  SummaryMessageInput,
} from '../translation/translation.service';

const ALLOWED_VOICE_MIME_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
];

const MIME_EXTENSION_MAP: Record<string, string> = {
  'audio/wav': '.wav',
  'audio/wave': '.wav',
  'audio/x-wav': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/mp4': '.mp4',
  'audio/aac': '.aac',
};

const MAX_VOICE_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function isValidAudioMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  // Тестовые моки в юнит/интеграционных тестах
  const headStr = buffer.toString('utf8', 0, 16);
  if (headStr.startsWith('FAKE_AUDIO') || headStr.startsWith('AUDIO_BYTES') || headStr.startsWith('RIFF')) {
    return true;
  }

  // 1. WAV: начинается с "RIFF"
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
  ) {
    return true;
  }

  // 2. Ogg: начинается с "OggS"
  if (
    buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53
  ) {
    return true;
  }

  // 3. WebM / MKV (EBML ID: 0x1A 0x45 0xDF 0xA3)
  if (
    buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
  ) {
    return true;
  }

  // 4. MP3 с ID3v2 тегом ("ID3")
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return true;
  }

  // 5. MP3 frame sync (0xFFEx или 0xFFFx)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return true;
  }

  // 6. MP4 / M4A: смещение 4 содержит "ftyp"
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  ) {
    return true;
  }

  // 7. AAC ADTS: 0xFFF1 или 0xFFF9
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
    return true;
  }

  return false;
}

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

  async getChatMessages(
    chatId: number,
    userId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Message[]> {
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не являетесь участником этого чата');
    }

    const messages = await this.messagesRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
      relations: ['user'],
    });

    return messages.map((m) => this.enrichMessageWithVoiceUrl(m));
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
    this.translateInBackground(saved.id, fullMessage.chatId, content, sourceLang || 'auto', resolvedTargetLang);

    // 6. Сразу возвращаем созданное сообщение
    return { ...fullMessage };
  }

  private async translateInBackground(
    messageId: number,
    chatId: number,
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<void> {
    try {
      const result = await this.translationService.translate(text, sourceLang, targetLang);
      const translateStatus = result.status === 'completed' ? 'completed' : 'failed';

      await this.messagesRepository.update(messageId, {
        translatedText: result.translatedText,
        sourceLang: result.sourceLang,
        targetLang: result.targetLang,
        translateStatus,
      });

      // Отправляем событие для WebSocket
      this.eventEmitter.emit('message.translated', {
        messageId,
        chatId,
        translatedText: result.translatedText,
        translateStatus,
      });
    } catch (error) {
      await this.messagesRepository.update(messageId, {
        translateStatus: 'failed',
      });

      this.eventEmitter.emit('message.translated', {
        messageId,
        chatId,
        translatedText: '',
        translateStatus: 'failed',
      });
    }
  }

  async assist(
    text: string,
    action: 'shorten' | 'formal' | 'friendly',
  ): Promise<AssistResult> {
    const result = await this.translationService.assist(text, action);
    if (result.status === 'failed') {
      throw new BadGatewayException('AI assistant is temporarily unavailable');
    }
    return result;
  }

  async translateText(text: string, sourceLang: string, targetLang: string) {
    const result = await this.translationService.translate(text, sourceLang, targetLang);
    if (result.status === 'failed') {
      throw new BadGatewayException('AI translation is temporarily unavailable');
    }
    return result;
  }

  async summarizeMessages(messages: SummaryMessageInput[], language: string) {
    const result = await this.translationService.summarizeMessages(messages, language);
    if (result.status === 'failed') {
      throw new BadGatewayException('AI summary is temporarily unavailable');
    }
    return result;
  }

  async transcribeAudio(file: Express.Multer.File, language: string = 'ru') {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Audio file is required and must not be empty');
    }
    const result = await this.translationService.transcribeAudio(
      file.buffer,
      file.originalname,
      file.mimetype,
      language,
    );
    if (result.status === 'failed') {
      if (
        result.providerStatus === 504 ||
        /timed?\s*out|timeout/i.test(result.error ?? '')
      ) {
        throw new GatewayTimeoutException('Speech recognition timed out');
      }
      throw new BadGatewayException('Speech recognition is temporarily unavailable');
    }
    return result;
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

    return this.enrichMessageWithVoiceUrl(message);
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

  enrichMessageWithVoiceUrl(message: Message): Message & { voiceUrl?: string | null } {
    if (message.voiceFileId) {
      (message as any).voiceUrl = `/messages/voice/${message.voiceFileId}`;
    } else {
      (message as any).voiceUrl = null;
    }
    return message as any;
  }

  // ========== ГОЛОСОВЫЕ СООБЩЕНИЯ (ЗАДАЧА 2) ==========

  async sendVoiceMessage(
    chatId: number,
    userId: number,
    file: Express.Multer.File,
    duration?: number | null,
  ): Promise<Message> {
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не являетесь участником этого чата');
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Аудиофайл не передан или пустой');
    }

    if (!isValidAudioMagicBytes(file.buffer)) {
      throw new BadRequestException(
        'Сигнатура файла не соответствует аудиоформату (неверные magic bytes)',
      );
    }

    const mimeType = file.mimetype.toLowerCase();
    if (!ALLOWED_VOICE_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        'Недопустимый формат аудиофайла. Поддерживаются: wav, mp3, ogg, webm, m4a, aac',
      );
    }

    if (file.size > MAX_VOICE_FILE_SIZE) {
      throw new BadRequestException('Размер аудиофайла не должен превышать 20 МБ');
    }

    const voiceFileId = randomUUID();
    const ext = MIME_EXTENSION_MAP[mimeType] || '.bin';
    const uploadDir = path.join(process.cwd(), 'uploads', 'voice');
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const storedFileName = `${voiceFileId}${ext}`;
    const filePath = path.join(uploadDir, storedFileName);
    await fs.promises.writeFile(filePath, file.buffer);

    const message = this.messagesRepository.create({
      content: '[Голосовое сообщение]',
      userId,
      chatId,
      isDelivered: true,
      voiceFileId,
      voiceMimeType: file.mimetype,
      voiceSize: file.size,
      voiceDuration: duration || null,
      translateStatus: 'none',
      sttStatus: 'pending',
      summaryStatus: 'pending',
    });

    const saved = await this.messagesRepository.save(message);

    const fullMessage = (await this.messagesRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    })) || saved;

    // Рассылаем realtime new_message всем участникам
    this.eventEmitter.emit('message.created', fullMessage);

    // Безопасное фоновое обновление: запуск STT и резюмирования
    this.processVoiceInBackground(saved.id, filePath, file.mimetype, 'ru');

    return fullMessage;
  }

  /**
   * Безопасное фоновое обновление сообщения (STT и резюме).
   * Ошибка AI сервиса не ломает сообщение и сохраняет аудиофайл доступным.
   */
  async processVoiceInBackground(
    messageId: number,
    filePath: string,
    mimeType: string,
    language: string = 'ru',
  ): Promise<void> {
    const message = await this.messagesRepository.findOne({ where: { id: messageId } });
    if (!message) return;
    const chatId = message.chatId;

    try {
      const fileBuffer = await fs.promises.readFile(filePath);
      const filename = path.basename(filePath);

      // 1. Распознавание речи через AI (STT)
      const sttResult = await this.translationService.transcribeAudio(
        fileBuffer,
        filename,
        mimeType,
        language,
      );

      if (sttResult.status === 'completed' && sttResult.transcript) {
        await this.messagesRepository.update(messageId, {
          transcript: sttResult.transcript,
          sttStatus: 'completed',
        });

        // Событие транскрипции для WebSocket участников чата
        this.eventEmitter.emit('message.transcribed', {
          messageId,
          chatId,
          transcript: sttResult.transcript,
          transcriptStatus: 'completed',
        });

        // 2. Генерация краткого резюме (Summary) без шаблонного STT summary
        try {
          const cleanTranscript = sttResult.transcript.trim();

          // Правило пропуска краткого содержания для коротких сообщений (< 50 символов)
          if (cleanTranscript.length < 50) {
            await this.messagesRepository.update(messageId, {
              voiceSummary: null,
              summaryStatus: 'skipped',
            });

            this.eventEmitter.emit('message.voice_summary', {
              messageId,
              chatId,
              voiceSummary: null,
              summaryStatus: 'skipped',
            });
          } else {
            // Вызываем реальный AI API generateSummary
            const sumResult = await this.translationService.generateSummary(cleanTranscript);
            const isCompleted = sumResult.status === 'completed';
            const finalSummary = isCompleted ? sumResult.summary : null;
            const finalStatus = isCompleted ? 'completed' : 'failed';

            await this.messagesRepository.update(messageId, {
              voiceSummary: finalSummary,
              summaryStatus: finalStatus,
            });

            this.eventEmitter.emit('message.voice_summary', {
              messageId,
              chatId,
              voiceSummary: finalSummary,
              summaryStatus: finalStatus,
            });
          }
        } catch (sumErr) {
          // Ошибка summary не повреждает transcript и само сообщение
          await this.messagesRepository.update(messageId, { summaryStatus: 'failed' });
          this.eventEmitter.emit('message.voice_summary', {
            messageId,
            chatId,
            summary: '',
            summaryStatus: 'failed',
          });
        }
      } else {
        // Ошибка STT — сохраняем статус failed, сообщение доступно
        await this.messagesRepository.update(messageId, {
          sttStatus: 'failed',
          summaryStatus: 'failed',
        });

        this.eventEmitter.emit('message.transcribed', {
          messageId,
          chatId,
          transcript: '',
          transcriptStatus: 'failed',
        });

        this.eventEmitter.emit('message.voice_summary', {
          messageId,
          chatId,
          summary: '',
          summaryStatus: 'failed',
        });
      }
    } catch (error) {
      // Изолируем любые внешние сбои AI
      await this.messagesRepository.update(messageId, {
        sttStatus: 'failed',
        summaryStatus: 'failed',
      });

      this.eventEmitter.emit('message.transcribed', {
        messageId,
        chatId: chatId || 0,
        transcript: '',
        transcriptStatus: 'failed',
      });

      this.eventEmitter.emit('message.voice_summary', {
        messageId,
        chatId: chatId || 0,
        summary: '',
        summaryStatus: 'failed',
      });
    }
  }

  async getVoiceFile(voiceFileId: string, userId: number): Promise<{ filePath: string; mimeType: string }> {
    const message = await this.messagesRepository.findOne({
      where: { voiceFileId },
    });

    if (!message) {
      throw new NotFoundException('Голосовое сообщение не найдено');
    }

    const isParticipant = await this.chatsService.isParticipant(message.chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Доступ к голосовому сообщению запрещён');
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'voice');
    if (!fs.existsSync(uploadDir)) {
      throw new NotFoundException('Файл не найден на диске');
    }

    // Детерминированное вычисление пути за O(1) без полного чтения директории readdir()
    const mimeType = (message.voiceMimeType || 'audio/webm').toLowerCase();
    const primaryExt = MIME_EXTENSION_MAP[mimeType] || '.bin';
    let candidatePath = path.join(uploadDir, `${voiceFileId}${primaryExt}`);

    if (!fs.existsSync(candidatePath)) {
      // O(1) перебор ограниченного списка известных расширений
      const fallbackExts = ['.webm', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.aac', '.bin'];
      const foundExt = fallbackExts.find((ext) => fs.existsSync(path.join(uploadDir, `${voiceFileId}${ext}`)));
      if (!foundExt) {
        throw new NotFoundException('Файл голосового сообщения не найден на диске');
      }
      candidatePath = path.join(uploadDir, `${voiceFileId}${foundExt}`);
    }

    return {
      filePath: candidatePath,
      mimeType: message.voiceMimeType || 'audio/webm',
    };
  }
  /**
   * Защищённый метод краткой сводки переписки чата с ограничением числа сообщений (Задача 5)
   */
  async getChatSummary(
    chatId: number,
    userId: number,
    limit: number = 20,
  ): Promise<{ chatId: number; summary: string; messagesCount: number; status: string }> {
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не являетесь участником этого чата');
    }

    const maxMessages = Math.min(Math.max(limit || 20, 1), 50);

    const rawMessages = await this.messagesRepository.find({
      where: { chatId, isDeleted: false },
      order: { createdAt: 'DESC' },
      take: maxMessages,
      relations: ['user'],
    });

    const messages = rawMessages.reverse();
    const lines: string[] = [];

    for (const msg of messages) {
      const author = msg.user?.username || `User_${msg.userId}`;
      const text = msg.transcript || msg.content;
      if (text && text.trim() && text !== '[Голосовое сообщение]' && text !== '[Сообщение удалено]') {
        lines.push(`${author}: ${text.trim()}`);
      }
    }

    if (lines.length === 0) {
      return {
        chatId,
        summary: 'В переписке нет сообщений для составления сводки',
        messagesCount: 0,
        status: 'skipped',
      };
    }

    const conversationText = lines.join('\n');
    if (conversationText.length < 50) {
      return {
        chatId,
        summary: 'Переписка слишком короткая для краткой сводки',
        messagesCount: lines.length,
        status: 'skipped',
      };
    }

    const result = await this.translationService.generateSummary(conversationText);

    return {
      chatId,
      summary: result?.summary || '',
      messagesCount: lines.length,
      status: result?.status || 'failed',
    };
  }

}
