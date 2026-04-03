import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // Регистрация нового пользователя
  async register(registerDto: RegisterDto) {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Проверяем, существует ли пользователь с таким username
    const existingUsername = await this.usersService.findByUsername(registerDto.username);
    if (existingUsername) {
      throw new ConflictException('Пользователь с таким именем уже существует');
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Создаём пользователя
    const user = await this.usersService.create({
      email: registerDto.email,
      username: registerDto.username,
      password: hashedPassword,
    });

    // Проверяем, что пользователь создался и у него есть id
    if (!user || !user.id) {
      throw new Error('Не удалось создать пользователя');
    }

    // Генерируем токены
    const tokens = await this.generateTokens(user.id, user.email);

    // Сохраняем refresh token в БД
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Регистрация успешна',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        language: user.language,
      },
      ...tokens,
    };
  }

  // Логин
  async login(loginDto: LoginDto) {
    // Ищем пользователя по email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Проверяем, что у пользователя есть id
    if (!user.id) {
      throw new Error('ID пользователя не найден');
    }

    // Генерируем токены
    const tokens = await this.generateTokens(user.id, user.email);

    // Сохраняем refresh token в БД
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Вход выполнен успешно',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        language: user.language,
      },
      ...tokens,
    };
  }

  // Выход (удаляем refresh token)
  async logout(userId: number) {
    await this.usersService.saveRefreshToken(userId, null as any);
    return { message: 'Выход выполнен успешно' };
  }

  // Обновление токенов
  async refreshTokens(refreshToken: string) {
    const user = await this.usersService.findByRefreshToken(refreshToken);
    if (!user) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    // Проверяем валидность refresh token
    try {
      this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    // Проверяем, что у пользователя есть id
    if (!user.id) {
      throw new Error('ID пользователя не найден');
    }

    // Генерируем новые токены
    const tokens = await this.generateTokens(user.id, user.email);
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // Генерация access и refresh токенов
  private async generateTokens(userId: number, email: string) {
    const payload = { sub: userId, email: email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}