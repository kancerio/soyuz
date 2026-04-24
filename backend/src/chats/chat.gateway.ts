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

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // socketId -> userId
  private socketToUser: Map<string, number> = new Map();
  // userId -> socketId
  private userToSocket: Map<number, string> = new Map();
  // userId -> какие чаты слушает
  private userChats: Map<number, Set<number>> = new Map();

  constructor(
    private chatsService: ChatsService,
    private messagesService: MessagesService,
  ) {
    console.log('🔥 ChatGateway initialized');
  }

  // ========== ПОДКЛЮЧЕНИЕ / ОТКЛЮЧЕНИЕ ==========

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
    
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      // Удаляем из маппингов
      this.socketToUser.delete(client.id);
      this.userToSocket.delete(userId);
      
      // Уведомляем всех, что пользователь офлайн
      this.server.emit('user_offline', { userId });
      console.log(`📢 User ${userId} went offline`);
    }
  }

  // ========== АУТЕНТИФИКАЦИЯ ==========

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const { userId } = data;
    
    // Сохраняем маппинги
    this.socketToUser.set(client.id, userId);
    this.userToSocket.set(userId, client.id);
    
    // Получаем все чаты пользователя
    const chats = await this.chatsService.getUserChats(userId);
    const chatIds = chats.map(chat => chat.id);
    
    // Сохраняем чаты пользователя
    this.userChats.set(userId, new Set(chatIds));
    
    // Автоматически подключаем ко всем его чатам
    for (const chatId of chatIds) {
      const roomName = `chat_${chatId}`;
      client.join(roomName);
      console.log(`User ${userId} joined room ${roomName}`);
    }
    
    // Уведомляем всех, что пользователь онлайн
    this.server.emit('user_online', { userId });
    
    // Подтверждаем аутентификацию
    client.emit('auth_success', { 
      userId, 
      message: 'Authenticated successfully',
      chats: chatIds,
    });
    
    console.log(`✅ User ${userId} authenticated, joined ${chatIds.length} chats`);
  }

  // ========== ПРИСОЕДИНИТЬСЯ К ЧАТУ ==========

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    const { chatId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    // Проверяем, есть ли доступ к чату
    const chat = await this.chatsService.findOne(chatId);
    if (!chat) {
      client.emit('error', { message: 'Chat not found' });
      return;
    }
    
    // Присоединяемся к комнате
    const roomName = `chat_${chatId}`;
    client.join(roomName);
    
    // Сохраняем в список чатов пользователя
    if (!this.userChats.has(userId)) {
      this.userChats.set(userId, new Set());
    }
    this.userChats.get(userId)!.add(chatId);
    
    client.emit('chat_joined', { chatId });
    console.log(`User ${userId} joined chat ${chatId}`);
  }

  // ========== ПОКИНУТЬ ЧАТ ==========

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    const { chatId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) return;
    
    const roomName = `chat_${chatId}`;
    client.leave(roomName);
    
    // Удаляем из списка чатов пользователя
    this.userChats.get(userId)?.delete(chatId);
    
    client.emit('chat_left', { chatId });
    console.log(`User ${userId} left chat ${chatId}`);
  }

  // ========== ОТПРАВКА СООБЩЕНИЯ ==========

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number; content: string },
  ) {
    const { chatId, content } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      // Сохраняем сообщение в БД
      const message = await this.messagesService.sendMessage(chatId, userId, content);
      
      // 🚀 РАССЫЛАЕМ ВСЕМ В КОМНАТЕ (включая отправителя)
      this.server.to(`chat_${chatId}`).emit('new_message', message);
      
      console.log(`📨 Message sent to chat ${chatId} from user ${userId}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // ========== РЕДАКТИРОВАНИЕ СООБЩЕНИЯ ==========

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number; content: string },
  ) {
    const { messageId, content } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      const message = await this.messagesService.editMessage(messageId, userId, content);
      
      // Рассылаем обновление всем в комнате
      this.server.to(`chat_${message.chatId}`).emit('message_updated', {
        id: message.id,
        content: message.content,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
      });
      
      console.log(`📝 Message ${messageId} edited by user ${userId}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // ========== УДАЛЕНИЕ СООБЩЕНИЯ ==========

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const { messageId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      const message = await this.messagesService.getMessage(messageId);
      await this.messagesService.deleteMessage(messageId, userId);
      
      // Рассылаем уведомление всем в комнате
      this.server.to(`chat_${message.chatId}`).emit('message_deleted', {
        id: messageId,
        chatId: message.chatId,
      });
      
      console.log(`🗑️ Message ${messageId} deleted by user ${userId}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // ========== ИНДИКАТОР ПЕЧАТАЕТ ==========

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number; isTyping: boolean },
  ) {
    const { chatId, isTyping } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) return;
    
    // Отправляем только в конкретную комнату чата (кроме отправителя)
    client.to(`chat_${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping,
    });
  }

  // ========== ПОЛУЧИТЬ ОНЛАЙН-СТАТУС ПОЛЬЗОВАТЕЛЯ ==========

  @SubscribeMessage('get_user_status')
  async handleGetUserStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const { userId } = data;
    const isOnline = this.userToSocket.has(userId);
    
    client.emit('user_status', {
      userId,
      isOnline,
    });
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  // Получить всех онлайн пользователей
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsers = Array.from(this.userToSocket.keys());
    client.emit('online_users', { users: onlineUsers });
  }
}