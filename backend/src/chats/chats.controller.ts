import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatsService } from './chats.service';

@Controller('chats')
@UseGuards(AuthGuard('jwt'))
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  // ========== ОСНОВНЫЕ ЭНДПОИНТЫ ==========

  // GET /chats - получить все чаты пользователя
  @Get()
  async getUserChats(@Request() req) {
    return this.chatsService.getUserChats(req.user.userId);
  }

  // GET /chats/:id - получить чат по ID
  @Get(':id')
  async getChat(@Param('id') id: string, @Request() req) {
    const chat = await this.chatsService.findOne(+id);
    if (!chat) {
      return { message: 'Чат не найден' };
    }
    return chat;
  }

  // POST /chats/private/:userId - создать личный чат
  @Post('private/:userId')
  async createPrivateChat(@Param('userId') userId: string, @Request() req) {
    return this.chatsService.createPrivateChat(req.user.userId, +userId);
  }

  // POST /chats/group - создать групповой чат
  @Post('group')
  async createGroupChat(
    @Request() req,
    @Body('title') title: string,
    @Body('participantIds') participantIds: number[],
  ) {
    return this.chatsService.createGroupChat(title, req.user.userId, participantIds);
  }

  // PATCH /chats/:id - обновить название чата
  @Patch(':id')
  async updateChatTitle(
    @Param('id') id: string,
    @Body('title') title: string,
  ) {
    return this.chatsService.updateChatTitle(+id, title);
  }

  // DELETE /chats/:id - удалить чат (только владелец)
  @Delete(':id')
  async deleteChat(@Param('id') id: string) {
    await this.chatsService.deleteChat(+id);
    return { message: 'Чат удалён' };
  }

  // ========== УПРАВЛЕНИЕ УЧАСТНИКАМИ ==========

  // GET /chats/:chatId/members - получить список участников с ролями
  @Get(':chatId/members')
  async getChatMembers(@Param('chatId') chatId: string) {
    const members = await this.chatsService.getChatMembers(+chatId);
    return members.map(m => ({
      userId: m.userId,
      role: m.role,
    }));
  }

  // GET /chats/:chatId/members/:userId/role - получить роль участника
  @Get(':chatId/members/:userId/role')
  async getUserRole(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
  ) {
    const role = await this.chatsService.getUserRole(+chatId, +userId);
    return { userId: +userId, role };
  }

  // POST /chats/:chatId/members/:userId - добавить участника
  @Post(':chatId/members/:userId')
  async addParticipant(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
  ) {
    return this.chatsService.addParticipant(+chatId, +userId);
  }

  @Delete(':chatId/members/me')
async leaveChat(@Param('chatId') chatId: string, @Request() req) {
  await this.chatsService.leaveChat(+chatId, req.user.userId);
  return { message: 'Вы вышли из чата' };
}

  // PATCH /chats/:chatId/members/:userId/role - изменить роль участника
  @Patch(':chatId/members/:userId/role')
  async changeRole(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Body('role') role: string,
  ) {
    const result = await this.chatsService.changeRole(+chatId, +userId, role);
    return {
      userId: result.userId,
      chatId: result.chatId,
      role: result.role,
    };
  }
}