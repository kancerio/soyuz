import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MessagesService } from './messages.service';
import { ChatsService } from '../chats/chats.service';
import { AssistDto } from './dto/assist.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ChatSummaryDto } from './dto/chat-summary.dto';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatsService: ChatsService,
  ) {}

  @Get('chat/:chatId')
  async getChatMessages(
    @Request() req,
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.messagesService.getChatMessages(
      +chatId,
      req.user.userId,
      limit ? +limit : 50,
      offset ? +offset : 0,
    );
  }

  @Post('chat/:chatId')
  async sendMessage(
    @Request() req,
    @Param('chatId') chatId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.messagesService.sendMessageWithTranslation(
      +chatId,
      req.user.userId,
      body.content,
      body.sourceLang,
      body.targetLang,
    );
  }

  @Post('chat/:chatId/voice')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async sendVoiceMessage(
    @Request() req,
    @Param('chatId') chatId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('duration') duration?: string,
  ) {
    return this.messagesService.sendVoiceMessage(
      +chatId,
      req.user.userId,
      file,
      duration ? +duration : null,
    );
  }

  @Get('voice/:fileId')
  async getVoiceFile(
    @Request() req,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const { filePath, mimeType } = await this.messagesService.getVoiceFile(
      fileId,
      req.user.userId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(filePath);
  }

  @Post('assist')
async assist(@Body() body: AssistDto) {
  return this.messagesService.assist(body.text, body.action);
}

    @Get('chat/:chatId/summary')
  async getChatSummary(
    @Request() req,
    @Param('chatId') chatId: string,
    @Query() query?: ChatSummaryDto,
  ) {
    return this.messagesService.getChatSummary(
      +chatId,
      req.user.userId,
      (query && typeof query === 'object' && query.limit != null ? Number(query.limit) : (query ? Number(query) : 20)),
    );
  }

  @Post('chat/:chatId/summary')
  async createChatSummary(
    @Request() req,
    @Param('chatId') chatId: string,
    @Body() body?: ChatSummaryDto,
  ) {
    return this.messagesService.getChatSummary(
      +chatId,
      req.user.userId,
      (body && typeof body === 'object' && body.limit != null ? Number(body.limit) : (body ? Number(body) : 20)),
    );
  }

  @Put(':messageId')
  async editMessage(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() body: EditMessageDto,
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