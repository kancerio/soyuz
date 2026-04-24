import { Controller, Post, Get, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Request() req) {
    return this.authService.logout(req.user.userId);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token обязателен');
    }
    return this.authService.refreshTokens(refreshToken);
  }

  // ↓↓↓ ИСПРАВЛЕННЫЙ МЕТОД ↓↓↓
  @Get('me')
  @UseGuards(AuthGuard('jwt'))  // ← убрал ', any'
  async getCurrentUser(@Request() req) {  // ← добавил @Request() req
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      language: user.preferred_language || 'en',
      createdAt: user.createdAt,
    };
  }
}