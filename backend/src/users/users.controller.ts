import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')  // Все маршруты будут начинаться с /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()  // Обрабатывает GET запросы на /users
  findAll() {
    return this.usersService.findAll();
  }
}