import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TranslationService } from './translation.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    RedisModule,
  ],
  providers: [TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}