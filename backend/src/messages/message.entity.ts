import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from '../chats/chat.entity';

export type TranslateStatus = 'pending' | 'completed' | 'failed' | 'skipped';

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

  // ========== НОВЫЕ ПОЛЯ ДЛЯ ПЕРЕВОДА ==========
  @Column({ type: 'text', nullable: true })
  originalText: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  sourceLang: string;

  @Column({ type: 'text', nullable: true })
  translatedText: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  targetLang: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  translateStatus: TranslateStatus;
  // ==============================================

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date;
}