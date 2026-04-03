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

  // Создать нового пользователя
  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }
}