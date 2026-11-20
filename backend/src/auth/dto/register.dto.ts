import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, Matches } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../common/languages';

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
  @IsIn([...SUPPORTED_LANGUAGES], {
    message: `Язык должен быть одним из: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  preferred_language?: string;

  // Двухбуквенный ISO 3166-1 alpha-2 код страны — контекст для строительных терминов
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/, { message: 'Код страны должен быть двухбуквенным ISO-кодом' })
  country_code?: string;
}