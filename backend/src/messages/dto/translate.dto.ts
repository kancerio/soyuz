import { IsString, MaxLength, MinLength } from 'class-validator';

export class TranslateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  source_lang: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  target_lang: string;
}
