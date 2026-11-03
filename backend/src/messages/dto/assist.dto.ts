import { IsIn, IsString, MinLength, MaxLength } from 'class-validator';

export class AssistDto {
  @IsString()
  @MinLength(1, { message: 'Текст не может быть пустым' })
  @MaxLength(5000, { message: 'Текст не должен превышать 5000 символов' })
  text: string;

  @IsIn(['shorten', 'formal', 'friendly'], {
    message: 'Действие должно быть одним из: shorten, formal, friendly',
  })
  action: 'shorten' | 'formal' | 'friendly';
}