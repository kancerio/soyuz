import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // регистрируем Entity
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // чтобы другие модули могли использовать
})
export class UsersModule {}