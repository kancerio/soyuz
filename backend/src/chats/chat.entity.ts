import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { ChatParticipant } from './chat-participant.entity';
import { Message } from '../messages/message.entity';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'boolean', default: false })
  isGroup: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => ChatParticipant, (participant) => participant.chat)
  participants: ChatParticipant[];

  @OneToMany(() => Message, (message) => message.chatId)
  messages: Message[];
}