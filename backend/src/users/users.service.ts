import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // Получить всех пользователей
  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  // Найти пользователя по ID
  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  // Найти пользователя по email
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  // Найти пользователя по username
  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

  // Создать нового пользователя
  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  // Обновить пользователя
  async update(id: number, userData: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(id, userData);
    return this.findOne(id);
  }

  // Сохранить refresh token
  async saveRefreshToken(userId: number, refreshToken: string | null): Promise<void> {
    await this.usersRepository.update(userId, { refreshToken: refreshToken as any });
}
  // Найти пользователя по refresh token
  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ refreshToken });
  }
}