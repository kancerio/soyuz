import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
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

  // GET /chats/:id - получить чат по ID (только участникам)
  @Get(':id')
  async getChat(@Param('id') id: string, @Request() req) {
    const chat = await this.chatsService.findOne(+id);
    const isParticipant = await this.chatsService.isParticipant(+id, req.user.userId);
    if (!chat || !isParticipant) {
      // Не раскрываем существование чата посторонним
      throw new NotFoundException('Чат не найден');
    }
    return {
      id: chat.id,
      title: chat.title,
      isGroup: chat.isGroup,
      createdAt: chat.createdAt,
      participants: (chat.participants ?? []).map((p) => ({
        userId: p.userId,
        role: p.role,
        username: p.user?.username ?? '',
      })),
    };
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

  // PATCH /chats/:id - обновить название чата (owner/admin)
  @Patch(':id')
  async updateChatTitle(
    @Param('id') id: string,
    @Body('title') title: string,
    @Request() req,
  ) {
    return this.chatsService.updateChatTitle(+id, title, req.user.userId);
  }

  // DELETE /chats/:id - удалить чат (только владелец)
  @Delete(':id')
  async deleteChat(@Param('id') id: string, @Request() req) {
    await this.chatsService.deleteChat(+id, req.user.userId);
    return { message: 'Чат удалён' };
  }

  // ========== УПРАВЛЕНИЕ УЧАСТНИКАМИ ==========

  // GET /chats/:chatId/members - получить список участников с ролями (только участникам)
  @Get(':chatId/members')
  async getChatMembers(@Param('chatId') chatId: string, @Request() req) {
    const isParticipant = await this.chatsService.isParticipant(+chatId, req.user.userId);
    if (!isParticipant) {
      throw new NotFoundException('Чат не найден');
    }
    const members = await this.chatsService.getChatMembers(+chatId);
    return members.map(m => ({
      userId: m.userId,
      username: m.user?.username ?? '',
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

  // POST /chats/:chatId/members/:userId - добавить участника (owner/admin)
  @Post(':chatId/members/:userId')
  async addParticipant(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    return this.chatsService.addParticipant(+chatId, +userId, req.user.userId);
  }

  @Delete(':chatId/members/me')
async leaveChat(@Param('chatId') chatId: string, @Request() req) {
  await this.chatsService.leaveChat(+chatId, req.user.userId);
  return { message: 'Вы вышли из чата' };
}

  // DELETE /chats/:chatId/members/:userId - исключить участника (owner/admin)
  @Delete(':chatId/members/:userId')
  async removeMember(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    await this.chatsService.removeParticipant(+chatId, +userId, req.user.userId);
    return { message: 'Участник исключён' };
  }

  // PATCH /chats/:chatId/members/:userId/role - изменить роль участника (только владелец)
  @Patch(':chatId/members/:userId/role')
  async changeRole(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Body('role') role: string,
    @Request() req,
  ) {
    const result = await this.chatsService.changeRole(+chatId, +userId, role, req.user.userId);
    return {
      userId: result.userId,
      chatId: result.chatId,
      role: result.role,
    };
  }
}
