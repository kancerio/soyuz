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
import { Logger } from '@nestjs/common';
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

  private readonly logger = new Logger(ChatGateway.name);

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
    this.logger.log('🔥 ChatGateway initialized');
  }

  // ========== ПОДКЛЮЧЕНИЕ / ОТКЛЮЧЕНИЕ ==========

  handleConnection(client: Socket) {
    const timestamp = new Date().toISOString();
    this.logger.log(`🔌 WebSocket connection | socket_id: ${client.id} | timestamp: ${timestamp}`);
  }

  async handleDisconnect(client: Socket) {
    const timestamp = new Date().toISOString();
    const userId = this.socketToUser.get(client.id);
    
    this.logger.log(`🔌 WebSocket disconnection | socket_id: ${client.id} | user_id: ${userId || 'unknown'} | timestamp: ${timestamp}`);
    
    if (userId) {
      // Удаляем из маппингов
      this.socketToUser.delete(client.id);
      this.userToSocket.delete(userId);
      
      // Уведомляем всех, что пользователь офлайн
      this.server.emit('user_offline', { userId });
      this.logger.log(`📢 User offline broadcast | user_id: ${userId} | timestamp: ${timestamp}`);
    }
  }

  // ========== АУТЕНТИФИКАЦИЯ ==========

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const timestamp = new Date().toISOString();
    const { userId } = data;
    
    this.logger.log(`🔐 Auth attempt | socket_id: ${client.id} | user_id: ${userId} | timestamp: ${timestamp}`);
    
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
      this.logger.log(`🏠 User joined room | user_id: ${userId} | room: ${roomName} | timestamp: ${timestamp}`);
    }
    
    // Уведомляем всех, что пользователь онлайн
    this.server.emit('user_online', { userId });
    this.logger.log(`📢 User online broadcast | user_id: ${userId} | timestamp: ${timestamp}`);
    
    // Подтверждаем аутентификацию
    client.emit('auth_success', { 
      userId, 
      message: 'Authenticated successfully',
      chats: chatIds,
    });
    
    this.logger.log(`✅ Auth success | user_id: ${userId} | joined_chats: ${chatIds.length} | timestamp: ${timestamp}`);
  }

  // ========== ПРИСОЕДИНИТЬСЯ К ЧАТУ ==========

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    const timestamp = new Date().toISOString();
    const { chatId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      this.logger.warn(`⚠️ Join chat failed - not authenticated | socket_id: ${client.id} | chat_id: ${chatId} | timestamp: ${timestamp}`);
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    // Проверяем, есть ли доступ к чату
    const chat = await this.chatsService.findOne(chatId);
    if (!chat) {
      this.logger.warn(`⚠️ Join chat failed - chat not found | user_id: ${userId} | chat_id: ${chatId} | timestamp: ${timestamp}`);
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
    this.logger.log(`🏠 User joined chat room | user_id: ${userId} | chat_id: ${chatId} | room: ${roomName} | timestamp: ${timestamp}`);
  }

  // ========== ПОКИНУТЬ ЧАТ ==========

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    const timestamp = new Date().toISOString();
    const { chatId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) return;
    
    const roomName = `chat_${chatId}`;
    client.leave(roomName);
    
    // Удаляем из списка чатов пользователя
    this.userChats.get(userId)?.delete(chatId);
    
    client.emit('chat_left', { chatId });
    this.logger.log(`🚪 User left chat room | user_id: ${userId} | chat_id: ${chatId} | room: ${roomName} | timestamp: ${timestamp}`);
  }

  // ========== ОТПРАВКА СООБЩЕНИЯ ==========

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number; content: string },
  ) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const { chatId, content } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      this.logger.warn(`⚠️ Send message failed - not authenticated | socket_id: ${client.id} | chat_id: ${chatId} | timestamp: ${timestamp}`);
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      // Сохраняем сообщение в БД
      const message = await this.messagesService.sendMessage(chatId, userId, content);
      
      const dbSaveTime = Date.now() - startTime;
      
      // Рассылаем всем в комнате (включая отправителя)
      this.server.to(`chat_${chatId}`).emit('new_message', message);
      
      const broadcastTime = Date.now() - startTime - dbSaveTime;
      
      this.logger.log(`📨 Message sent | message_id: ${message.id} | user_id: ${userId} | chat_id: ${chatId} | db_save_ms: ${dbSaveTime} | broadcast_ms: ${broadcastTime} | timestamp: ${timestamp}`);
    } catch (error) {
      this.logger.error(`❌ Send message error | user_id: ${userId} | chat_id: ${chatId} | error: ${error.message} | timestamp: ${timestamp}`);
      client.emit('error', { message: error.message });
    }
  }

  // ========== РЕДАКТИРОВАНИЕ СООБЩЕНИЯ ==========

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number; content: string },
  ) {
    const timestamp = new Date().toISOString();
    const { messageId, content } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      this.logger.warn(`⚠️ Edit message failed - not authenticated | socket_id: ${client.id} | message_id: ${messageId} | timestamp: ${timestamp}`);
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
      
      this.logger.log(`📝 Message edited | message_id: ${messageId} | user_id: ${userId} | chat_id: ${message.chatId} | timestamp: ${timestamp}`);
    } catch (error) {
      this.logger.error(`❌ Edit message error | user_id: ${userId} | message_id: ${messageId} | error: ${error.message} | timestamp: ${timestamp}`);
      client.emit('error', { message: error.message });
    }
  }

  // ========== УДАЛЕНИЕ СООБЩЕНИЯ ==========

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const timestamp = new Date().toISOString();
    const { messageId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      this.logger.warn(`⚠️ Delete message failed - not authenticated | socket_id: ${client.id} | message_id: ${messageId} | timestamp: ${timestamp}`);
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
      
      this.logger.log(`🗑️ Message deleted | message_id: ${messageId} | user_id: ${userId} | chat_id: ${message.chatId} | timestamp: ${timestamp}`);
    } catch (error) {
      this.logger.error(`❌ Delete message error | user_id: ${userId} | message_id: ${messageId} | error: ${error.message} | timestamp: ${timestamp}`);
      client.emit('error', { message: error.message });
    }
  }

  // ========== ИНДИКАТОР ПЕЧАТАЕТ ==========

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number; isTyping: boolean },
  ) {
    const timestamp = new Date().toISOString();
    const { chatId, isTyping } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) return;
    
    // Отправляем только в конкретную комнату чата (кроме отправителя)
    client.to(`chat_${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping,
    });
    
    this.logger.debug(`⌨️ Typing indicator | user_id: ${userId} | chat_id: ${chatId} | is_typing: ${isTyping} | timestamp: ${timestamp}`);
  }

  // ========== ПОЛУЧИТЬ ОНЛАЙН-СТАТУС ПОЛЬЗОВАТЕЛЯ ==========

  @SubscribeMessage('get_user_status')
  async handleGetUserStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const timestamp = new Date().toISOString();
    const { userId } = data;
    const isOnline = this.userToSocket.has(userId);
    
    client.emit('user_status', {
      userId,
      isOnline,
    });
    
    this.logger.debug(`🔍 User status check | requested_user: ${userId} | is_online: ${isOnline} | timestamp: ${timestamp}`);
  }

  // ========== ПОЛУЧИТЬ ВСЕХ ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ ==========

  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const timestamp = new Date().toISOString();
    const onlineUsers = Array.from(this.userToSocket.keys());
    
    client.emit('online_users', { users: onlineUsers });
    
    this.logger.debug(`👥 Online users requested | online_count: ${onlineUsers.length} | users: [${onlineUsers.join(', ')}] | timestamp: ${timestamp}`);
  }
}