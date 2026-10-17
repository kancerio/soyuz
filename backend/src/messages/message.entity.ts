import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from '../chats/chat.entity';

export type TranslateStatus = 'pending' | 'completed' | 'failed' | 'skipped' | 'none';
export type SttStatus = 'pending' | 'completed' | 'failed' | 'none';
export type SummaryStatus = 'pending' | 'completed' | 'failed' | 'none';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  encryptedContent: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Chat, (chat) => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @Column()
  chatId: number;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  // ========== СТАТУСЫ ДОСТАВКИ ==========
  @Column({ type: 'boolean', default: false })
  isDelivered: boolean;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;
  // ======================================

  // ========== ПОЛЯ ДЛЯ ПЕРЕВОДА ==========
  @Column({ type: 'text', nullable: true })
  originalText: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sourceLang: string;

  @Column({ type: 'text', nullable: true })
  translatedText: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  targetLang: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  translateStatus: TranslateStatus;
  // =======================================

  // ========== ПОЛЯ ДЛЯ ГОЛОСОВЫХ СООБЩЕНИЙ И STT ==========
  @Column({ type: 'varchar', length: 64, nullable: true })
  voiceFileId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  voiceMimeType: string | null;

  @Column({ type: 'integer', nullable: true })
  voiceSize: number | null;

  @Column({ type: 'integer', nullable: true })
  voiceDuration: number | null;

  @Column({ type: 'text', nullable: true })
  transcript: string | null;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  sttStatus: SttStatus;

  @Column({ type: 'text', nullable: true })
  voiceSummary: string | null;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  summaryStatus: SummaryStatus;
  // ========================================================

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date;
}