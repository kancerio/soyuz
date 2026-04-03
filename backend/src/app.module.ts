import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';      // ← добавить
import { MessagesModule } from './messages/messages.module';  // ← добавить
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,  // оставляем false, таблицы создаём вручную
        logging: true,
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    ChatsModule,      // ← добавить
    MessagesModule,   // ← добавить
    RedisModule,
  ],
})
export class AppModule {}