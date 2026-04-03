import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Загрузка переменных из .env файла
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // Подключение к PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // автоматически находит entity-классы
        synchronize: true, // автоматически создаёт таблицы (только для разработки!)
        logging: true, // показывает SQL-запросы в консоли
      }),
      inject: [ConfigService],
    }),
    
    UsersModule,
  ],
})
export class AppModule {}