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
import { logger } from '../common/logger';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketToUser: Map<string, number> = new Map();
  private userToSocket: Map<number, string> = new Map();
  private userChats: Map<number, Set<number>> = new Map();

  constructor(
    private chatsService: ChatsService,
    private messagesService: MessagesService,
  ) {
    logger.info('ChatGateway initialized', { component: 'ChatGateway', event: 'init' });
  }

  handleConnection(client: Socket) {
    logger.info('WebSocket connection', {
      event: 'connection',
      socket_id: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    
    logger.info('WebSocket disconnection', {
      event: 'disconnection',
      socket_id: client.id,
      user_id: userId || null,
      timestamp: new Date().toISOString(),
    });
    
    if (userId) {
      this.socketToUser.delete(client.id);
      this.userToSocket.delete(userId);
      this.server.emit('user_offline', { userId });
      
      logger.info('User offline broadcast', {
        event: 'user_offline',
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const { userId } = data;
    const startTime = Date.now();
    
    logger.info('Auth attempt', {
      event: 'auth_attempt',
      socket_id: client.id,
      user_id: userId,
      timestamp: new Date().toISOString(),
    });
    
    this.socketToUser.set(client.id, userId);
    this.userToSocket.set(userId, client.id);
    
    const chats = await this.chatsService.getUserChats(userId);
    const chatIds = chats.map(chat => chat.id);
    this.userChats.set(userId, new Set(chatIds));
    
    for (const chatId of chatIds) {
      const roomName = `chat_${chatId}`;
      client.join(roomName);
      
      logger.debug('User joined room', {
        event: 'join_room',
        user_id: userId,
        chat_id: chatId,
        room: roomName,
        timestamp: new Date().toISOString(),
      });
    }
    
    this.server.emit('user_online', { userId });
    
    const authDuration = Date.now() - startTime;
    
    client.emit('auth_success', { 
      userId, 
      message: 'Authenticated successfully',
      chats: chatIds,
    });
    
    logger.info('Auth success', {
      event: 'auth_success',
      user_id: userId,
      joined_chats_count: chatIds.length,
      joined_chats: chatIds,
      duration_ms: authDuration,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    const { chatId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      logger.warn('Join chat failed - not authenticated', {
        event: 'join_chat_failed',
        socket_id: client.id,
        chat_id: chatId,
        reason: 'not_authenticated',
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    const chat = await this.chatsService.findOne(chatId);
    if (!chat) {
      logger.warn('Join chat failed - chat not found', {
        event: 'join_chat_failed',
        user_id: userId,
        chat_id: chatId,
        reason: 'chat_not_found',
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: 'Chat not found' });
      return;
    }
    
    const roomName = `chat_${chatId}`;
    client.join(roomName);
    
    if (!this.userChats.has(userId)) {
      this.userChats.set(userId, new Set());
    }
    this.userChats.get(userId)!.add(chatId);
    
    client.emit('chat_joined', { chatId });
    
    logger.info('User joined chat', {
      event: 'join_chat',
      user_id: userId,
      chat_id: chatId,
      room: roomName,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number; content: string },
  ) {
    const startTime = Date.now();
    const { chatId, content } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      logger.warn('Send message failed - not authenticated', {
        event: 'send_message_failed',
        socket_id: client.id,
        chat_id: chatId,
        reason: 'not_authenticated',
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      const message = await this.messagesService.sendMessage(chatId, userId, content);
      
      const dbSaveTime = Date.now() - startTime;
      
      this.server.to(`chat_${chatId}`).emit('new_message', message);
      
      const totalTime = Date.now() - startTime;
      
      logger.info('Message sent', {
        event: 'send_message',
        message_id: message.id,
        user_id: userId,
        chat_id: chatId,
        content_length: content.length,
        db_save_ms: dbSaveTime,
        broadcast_ms: totalTime - dbSaveTime,
        total_ms: totalTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Send message error', {
        event: 'send_message_error',
        user_id: userId,
        chat_id: chatId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number; content: string },
  ) {
    const { messageId, content } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      logger.warn('Edit message failed - not authenticated', {
        event: 'edit_message_failed',
        socket_id: client.id,
        message_id: messageId,
        reason: 'not_authenticated',
        timestamp: new Date().toISOString(),
      });
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
      
      logger.info('Message edited', {
        event: 'edit_message',
        message_id: messageId,
        user_id: userId,
        chat_id: message.chatId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Edit message error', {
        event: 'edit_message_error',
        user_id: userId,
        message_id: messageId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const { messageId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      logger.warn('Delete message failed - not authenticated', {
        event: 'delete_message_failed',
        socket_id: client.id,
        message_id: messageId,
        reason: 'not_authenticated',
        timestamp: new Date().toISOString(),
      });
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
      
      logger.info('Message deleted', {
        event: 'delete_message',
        message_id: messageId,
        user_id: userId,
        chat_id: message.chatId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Delete message error', {
        event: 'delete_message_error',
        user_id: userId,
        message_id: messageId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number; isTyping: boolean },
  ) {
    const { chatId, isTyping } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) return;
    
    client.to(`chat_${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping,
    });
    
    logger.debug('Typing indicator', {
      event: 'typing',
      user_id: userId,
      chat_id: chatId,
      is_typing: isTyping,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsers = Array.from(this.userToSocket.keys());
    
    client.emit('online_users', { users: onlineUsers });
    
    logger.debug('Online users requested', {
      event: 'get_online_users',
      online_count: onlineUsers.length,
      users: onlineUsers,
      timestamp: new Date().toISOString(),
    });
  }
}