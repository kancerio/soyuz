import { Controller, Get, Patch, Body, UseGuards, Request, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { isSupportedLanguage } from '../common/languages';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    // Только публичные поля: password/refreshToken не покидают сервер
    return this.usersService.findAllPublic();
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
      country: user.country_code,
      createdAt: user.createdAt,
    };
  }

  @Patch('language')
  @UseGuards(AuthGuard('jwt'))
  async updateLanguage(@Request() req, @Body('language') language: string) {
    if (!isSupportedLanguage(language)) {
      throw new BadRequestException('Неподдерживаемый код языка');
    }
    const user = await this.usersService.update(req.user.userId, { preferred_language: language.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      language: user.preferred_language,
      country: user.country_code,
    };
  }

  @Patch('country')
  @UseGuards(AuthGuard('jwt'))
  async updateCountry(@Request() req, @Body('country') country: string) {
    const normalized = typeof country === 'string' ? country.trim().toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new BadRequestException('Код страны должен быть двухбуквенным ISO-кодом');
    }
    const user = await this.usersService.update(req.user.userId, { country_code: normalized });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      language: user.preferred_language,
      country: user.country_code,
    };
  }
}