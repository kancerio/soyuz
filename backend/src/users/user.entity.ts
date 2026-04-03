import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users') // название таблицы в БД
export class User {
  @PrimaryGeneratedColumn() // автоинкрементный ID
  id: number;

  @Column({ unique: true }) // уникальный email
  email: string;

  @Column({ unique: true }) // уникальное имя пользователя
  username: string;

  @Column() // пароль (будет храниться в зашифрованном виде)
  password: string;

  @Column({ default: 'ru' }) // язык интерфейса (ru/en)
  language: string;

  @CreateDateColumn() // дата создания (заполняется автоматически)
  createdAt: Date;
}