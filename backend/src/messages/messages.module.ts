import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Message } from './message.entity';
import { UsersModule } from '../users/users.module';
import { ChatsModule } from '../chats/chats.module';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    UsersModule,
    forwardRef(() => ChatsModule),  // ← forwardRef для ChatsModule
    TranslationModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}