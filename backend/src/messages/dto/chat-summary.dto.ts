import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Лимит сообщений должен быть целым числом' })
  @Min(1, { message: 'Минимальное количество сообщений: 1' })
  @Max(50, { message: 'Максимальное количество сообщений: 50' })
  limit?: number = 20;
}
