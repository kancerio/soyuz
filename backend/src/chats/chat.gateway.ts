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
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    private chatsService: ChatsService,
    private messagesService: MessagesService,
  ) {
    logger.info('ChatGateway initialized', { component: 'ChatGateway', event: 'init' });
    
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 30000);
  }

  private checkHeartbeats() {
    for (const [socketId, userId] of this.socketToUser.entries()) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) {
        logger.warn('Socket dead - heartbeat missed', {
          event: 'heartbeat_missed',
          socket_id: socketId,
          user_id: userId,
          timestamp: new Date().toISOString(),
        });
        this.socketToUser.delete(socketId);
        this.userToSocket.delete(userId);
      }
    }
  }

  handleConnection(client: Socket) {
    const clientIp = client.handshake.address || client.conn.remoteAddress;
    logger.info('WebSocket connection', {
      event: 'connection',
      socket_id: client.id,
      client_ip: clientIp,
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
    const clientIp = client.handshake.address || client.conn.remoteAddress;
    
    logger.info('Auth attempt', {
      event: 'auth_attempt',
      socket_id: client.id,
      user_id: userId,
      client_ip: clientIp,
      timestamp: new Date().toISOString(),
    });
    
    this.socketToUser.set(client.id, userId);
    this.userToSocket.set(userId, client.id);
    
    const chats = await this.chatsService.getUserChats(userId);
    const chatIds = chats.map(chat => chat.id);
    
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
    
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      logger.warn('Join chat failed - not a participant', {
        event: 'join_chat_failed',
        user_id: userId,
        chat_id: chatId,
        reason: 'not_participant',
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: 'You are not a participant of this chat' });
      return;
    }
    
    const roomName = `chat_${chatId}`;
    client.join(roomName);
    
    client.emit('chat_joined', { chatId });
    
    logger.info('User joined chat', {
      event: 'join_chat',
      user_id: userId,
      chat_id: chatId,
      room: roomName,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    const { chatId } = data;
    const userId = this.socketToUser.get(client.id);
    
    if (!userId) {
      logger.warn('Leave chat failed - not authenticated', {
        event: 'leave_chat_failed',
        socket_id: client.id,
        chat_id: chatId,
        reason: 'not_authenticated',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    const roomName = `chat_${chatId}`;
    client.leave(roomName);
    
    client.emit('chat_left', { chatId });
    
    logger.info('User left chat', {
      event: 'leave_chat',
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
    
    console.log('🔥🔥🔥 SEND_MESSAGE CALLED 🔥🔥🔥');
    console.log('userId:', userId);
    console.log('chatId:', chatId);
    console.log('content:', content);
    
    if (!userId) {
      console.log('❌ No userId, aborting');
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    console.log('isParticipant:', isParticipant);
    
    if (!isParticipant) {
      console.log('❌ Not a participant, aborting');
      client.emit('error', { message: 'You are not a participant of this chat' });
      return;
    }
    
    try {
      const message = await this.messagesService.sendMessage(chatId, userId, content);
      console.log('✅ Message saved, id:', message.id);
      
      await this.messagesService.markAsDelivered(message.id, userId);
      console.log('✅ Marked as delivered for sender');
      
      const dbSaveTime = Date.now() - startTime;
      
      const room = this.server.sockets.adapter.rooms.get(`chat_${chatId}`);
      const roomSize = room ? room.size : 0;
      console.log(`📊 Room chat_${chatId} has ${roomSize} sockets`);
      console.log(`📤 Broadcasting message ${message.id} to room chat_${chatId}`);
      
      this.server.to(`chat_${chatId}`).emit('new_message', message);
      
      console.log(`✅ Broadcast complete`);
      
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
      console.error('❌ Error in send_message:', error.message);
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
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      const message = await this.messagesService.getMessage(messageId);
      
      const isParticipant = await this.chatsService.isParticipant(message.chatId, userId);
      if (!isParticipant) {
        client.emit('error', { message: 'You are not a participant of this chat' });
        return;
      }
      
      const role = await this.chatsService.getUserRole(message.chatId, userId);
      const isAuthor = message.userId === userId;
      const canDeleteAny = role === 'owner' || role === 'admin';
      
      if (!isAuthor && !canDeleteAny) {
        client.emit('error', { message: 'You do not have permission to delete this message' });
        return;
      }
      
      await this.messagesService.deleteMessage(messageId, userId, role || undefined);
      
      this.server.to(`chat_${message.chatId}`).emit('message_deleted', {
        id: messageId,
        chatId: message.chatId,
      });
      
      logger.info('Message deleted', {
        event: 'delete_message',
        message_id: messageId,
        user_id: userId,
        chat_id: message.chatId,
        role: role || 'none',
        is_author: isAuthor,
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

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
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
      
      const isParticipant = await this.chatsService.isParticipant(message.chatId, userId);
      if (!isParticipant) {
        client.emit('error', { message: 'You are not a participant of this chat' });
        return;
      }
      
      await this.messagesService.markAsDelivered(messageId, userId);
      
      const senderSocketId = this.userToSocket.get(message.userId);
      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message_status_update', {
          messageId,
          status: 'delivered',
        });
      }
      
      logger.debug('Message marked as delivered', {
        event: 'message_delivered',
        message_id: messageId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Message delivered error', {
        event: 'message_delivered_error',
        message_id: messageId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
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
      
      const isParticipant = await this.chatsService.isParticipant(message.chatId, userId);
      if (!isParticipant) {
        client.emit('error', { message: 'You are not a participant of this chat' });
        return;
      }
      
      await this.messagesService.markAsRead(messageId, userId);
      
      const senderSocketId = this.userToSocket.get(message.userId);
      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message_status_update', {
          messageId,
          status: 'read',
          readAt: new Date().toISOString(),
        });
      }
      
      logger.debug('Message marked as read', {
        event: 'message_read',
        message_id: messageId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Message read error', {
        event: 'message_read_error',
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
    
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) return;
    
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