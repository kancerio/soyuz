import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { ChatsService } from '../chats/chats.service';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatsService: ChatsService,  // ← добавляем
  ) {}

  @Get('chat/:chatId')
  async getChatMessages(
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

  @Post('chat/:chatId')
  async sendMessage(
    @Request() req,
    @Param('chatId') chatId: string,
    @Body() body: { content: string },
  ) {
    return this.messagesService.sendMessage(+chatId, req.user.userId, body.content);
  }

  @Put(':messageId')
  async editMessage(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
  ) {
    return this.messagesService.editMessage(+messageId, req.user.userId, body.content);
  }

  @Delete(':messageId')
  async deleteMessage(@Param('messageId') messageId: string, @Request() req) {
    const message = await this.messagesService.getMessage(+messageId);
    const role = await this.chatsService.getUserRole(message.chatId, req.user.userId);
    return this.messagesService.deleteMessage(+messageId, req.user.userId, role || undefined);
  }
}