import { Injectable } from '@nestjs/common';

// Определяем тип пользователя (временно, потом перенесём в отдельный файл)
export type User = {
  id: number;
  email: string;
  username: string;
  createdAt: Date;
};

@Injectable()
export class UsersService {
  // Временное хранилище (потом заменим на базу данных)
  private users: User[] = [
    {
      id: 1,
      email: 'ivan@example.com',
      username: 'ivan',
      createdAt: new Date(),
    },
    {
      id: 2,
      email: 'maria@example.com',
      username: 'maria',
      createdAt: new Date(),
    },
  ];

  findAll(): User[] {
    return this.users;
  }
}