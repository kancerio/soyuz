import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  sourceLang?: string;

  @IsOptional()
  @IsString()
  targetLang?: string;
}
