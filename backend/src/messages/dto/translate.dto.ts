import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SUPPORTED_LANGUAGES = ['ru', 'en', 'de', 'fr', 'es', 'zh', 'ar'];

export class TranslateDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(5000)
  text: string;

  @IsIn([...SUPPORTED_LANGUAGES, 'auto'])
  source_lang: string;

  @IsIn(SUPPORTED_LANGUAGES)
  target_lang: string;
}
