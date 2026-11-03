import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../users/user.entity';

export type ChatRole = 'owner' | 'admin' | 'member';

@Entity('chat_participants')
export class ChatParticipant {
  @PrimaryColumn({ name: 'chat_id' })
  chatId: number;

  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role: ChatRole;

  @ManyToOne(() => Chat, (chat) => chat.participants)
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}