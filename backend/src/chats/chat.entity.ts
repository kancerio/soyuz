import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

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
}