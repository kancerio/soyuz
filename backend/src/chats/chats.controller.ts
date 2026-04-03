import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatsService } from './chats.service';

@Controller('chats')
@UseGuards(AuthGuard('jwt'))  // Все маршруты требуют авторизации
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  // Получить все чаты пользователя
  @Get()
  getUserChats(@Request() req) {
    return this.chatsService.getUserChats(req.user.userId);
  }

  // Получить чат по ID
  @Get(':id')
  getChat(@Param('id') id: string) {
    return this.chatsService.findOne(+id);
  }

  // Создать личный чат
  @Post('private/:userId')
  createPrivateChat(@Request() req, @Param('userId') userId: string) {
    return this.chatsService.createPrivateChat(req.user.userId, +userId);
  }

  // Создать групповой чат
  @Post('group')
  createGroupChat(
    @Request() req,
    @Body() body: { title: string; participantIds: number[] },
  ) {
    return this.chatsService.createGroupChat(body.title, req.user.userId, body.participantIds);
  }

  // Добавить участника
  @Post(':chatId/add/:userId')
  addParticipant(@Param('chatId') chatId: string, @Param('userId') userId: string) {
    return this.chatsService.addParticipant(+chatId, +userId);
  }
}