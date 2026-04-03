import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))  // Все маршруты требуют авторизации
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Получить сообщения чата
  @Get('chat/:chatId')
  getChatMessages(
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.messagesService.getChatMessages(
      +chatId,
      limit ? +limit : 50,
      offset ? +offset : 0,
    );
  }

  // Отправить сообщение
  @Post('chat/:chatId')
  sendMessage(
    @Request() req,
    @Param('chatId') chatId: string,
    @Body() body: { content: string },
  ) {
    return this.messagesService.sendMessage(+chatId, req.user.userId, body.content);
  }

  // Редактировать сообщение
  @Put(':messageId')
  editMessage(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
  ) {
    return this.messagesService.editMessage(+messageId, req.user.userId, body.content);
  }

  // Удалить сообщение
  @Delete(':messageId')
  deleteMessage(@Request() req, @Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(+messageId, req.user.userId);
  }
}