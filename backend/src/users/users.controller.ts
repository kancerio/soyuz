import { Controller, Get, Post, Patch, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() createUserDto: { email: string; username: string; password: string }) {
    return this.usersService.create(createUserDto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      language: user.preferred_language,
      createdAt: user.createdAt,
    };
  }

  @Patch('language')
  @UseGuards(AuthGuard('jwt'))
  async updateLanguage(@Request() req, @Body('language') language: string) {
    const user = await this.usersService.update(req.user.userId, { preferred_language: language });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      language: user.preferred_language,
    };
  }
}