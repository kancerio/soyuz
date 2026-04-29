import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { MessagesService } from '../messages/messages.service';

// DTO для сообщений
interface SendMessageDto {
  chatId: number;
  content: string;
}

interface JoinChatDto {
  chatId: number;
}

interface TypingDto {
  chatId: number;
  isTyping: boolean;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // userId -> socketId
  private userSockets: Map<number, string> = new Map();
  // socketId -> userId
  private socketUsers: Map<string, number> = new Map();
  // chatId -> Set(socketId)
  private chatRooms: Map<number, Set<string>> = new Map();

  constructor(
    private chatsService: ChatsService,
    private messagesService: MessagesService,
  ) {
    console.log('🔥 ChatGateway initialized');
  }

  // ========== СОБЫТИЯ ПОДКЛЮЧЕНИЯ ==========

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
    
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);
      
      // Уведомляем всех о выходе пользователя
      this.server.emit('user_offline', { userId });
    }
  }

  // ========== АУТЕНТИФИКАЦИЯ ==========

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const { userId } = data;
    
    // Сохраняем связь
    this.userSockets.set(userId, client.id);
    this.socketUsers.set(client.id, userId);
    
    // Подключаем ко всем чатам пользователя
    const userChats = await this.chatsService.getUserChats(userId);
    for (const chat of userChats) {
      await this.joinChatRoom(client, chat.id);
    }
    
    // Уведомляем всех о подключении
    this.server.emit('user_online', { userId });
    
    client.emit('auth_success', { userId, message: 'Authenticated successfully' });
    
    console.log(`✅ User ${userId} authenticated`);
  }

  // ========== РАБОТА С ЧАТАМИ ==========

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinChatDto,
  ) {
    const { chatId } = data;
    const userId = this.socketUsers.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    // Проверяем, имеет ли пользователь доступ к чату
    const chat = await this.chatsService.findOne(chatId);
    if (!chat) {
      client.emit('error', { message: 'Chat not found' });
      return;
    }
    
    await this.joinChatRoom(client, chatId);
    
    client.emit('chat_joined', { chatId });
    
    // Уведомляем других участников
    client.to(`chat_${chatId}`).emit('user_joined_chat', { userId, chatId });
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinChatDto,
  ) {
    const { chatId } = data;
    const userId = this.socketUsers.get(client.id);
    
    client.leave(`chat_${chatId}`);
    
    const room = this.chatRooms.get(chatId);
    if (room) {
      room.delete(client.id);
      if (room.size === 0) {
        this.chatRooms.delete(chatId);
      }
    }
    
    client.emit('chat_left', { chatId });
    client.to(`chat_${chatId}`).emit('user_left_chat', { userId, chatId });
  }

  // ========== СООБЩЕНИЯ ==========

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const { chatId, content } = data;
    const userId = this.socketUsers.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      // Сохраняем в БД
      const message = await this.messagesService.sendMessage(chatId, userId, content);
      
      // Рассылаем всем в комнате
      this.server.to(`chat_${chatId}`).emit('new_message', {
        id: message.id,
        content: message.content,
        userId: message.userId,
        chatId: message.chatId,
        createdAt: message.createdAt,
        isEdited: message.isEdited,
        isDeleted: message.isDeleted,
      });
      
      console.log(`📨 Message sent to chat ${chatId} from user ${userId}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number; content: string },
  ) {
    const { messageId, content } = data;
    const userId = this.socketUsers.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      const message = await this.messagesService.editMessage(messageId, userId, content);
      
      this.server.to(`chat_${message.chatId}`).emit('message_updated', {
        id: message.id,
        content: message.content,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
      });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const { messageId } = data;
    const userId = this.socketUsers.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      const message = await this.messagesService.getMessage(messageId);
      await this.messagesService.deleteMessage(messageId, userId);
      
      this.server.to(`chat_${message.chatId}`).emit('message_deleted', {
        id: messageId,
        chatId: message.chatId,
      });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // ========== ИНДИКАТОРЫ ==========

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ) {
    const { chatId, isTyping } = data;
    const userId = this.socketUsers.get(client.id);
    
    if (!userId) return;
    
    client.to(`chat_${chatId}`).emit('user_typing', { userId, chatId, isTyping });
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  private async joinChatRoom(client: Socket, chatId: number) {
    const roomName = `chat_${chatId}`;
    client.join(roomName);
    
    if (!this.chatRooms.has(chatId)) {
      this.chatRooms.set(chatId, new Set());
    }
    this.chatRooms.get(chatId)!.add(client.id);
  }
}