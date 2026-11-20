import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true, length: 255 })
  email: string;

  @Column({ type: 'varchar', unique: true, length: 100 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  refreshToken: string;

  @Column({ type: 'varchar', default: 'en', length: 2 })
  preferred_language: string;

  // Двухбуквенный ISO 3166-1 alpha-2 код страны — контекст для строительных терминов
  @Column({ name: 'country_code', type: 'varchar', default: 'RU', length: 2 })
  country_code: string;
}