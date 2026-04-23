import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email: string;

  @IsString()
  @MinLength(3, { message: 'Имя пользователя должно содержать минимум 3 символа' })
  @MaxLength(20, { message: 'Имя пользователя не должно превышать 20 символов' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password: string;

  @IsOptional()
  @IsIn(['ru', 'en', 'de', 'fr', 'es', 'zh', 'ar'], { 
    message: 'Язык должен быть одним из: ru, en, de, fr, es, zh, ar' 
  })
  preferred_language?: string;
}