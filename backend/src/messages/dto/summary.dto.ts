import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SummaryMessageDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(200)
  sender_id: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(5000)
  text: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class SummaryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SummaryMessageDto)
  messages: SummaryMessageDto[];

  @IsOptional()
  @IsIn(['ru', 'en', 'de', 'fr', 'es', 'zh', 'ar'])
  language = 'ru';
}
