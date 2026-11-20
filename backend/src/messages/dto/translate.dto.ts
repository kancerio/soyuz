import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../common/languages';

export class TranslateDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(5000)
  text: string;

  @IsIn([...SUPPORTED_LANGUAGES, 'auto'])
  source_lang: string;

  @IsIn([...SUPPORTED_LANGUAGES])
  target_lang: string;
}
