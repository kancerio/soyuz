import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatsService } from './chats.service';
import { MessagesService } from '../messages/messages.service';
import { Message } from '../messages/message.entity';

describe('ChatGateway - Realtime Unified Events (Задача 1)', () => {
  let gateway: ChatGateway;
  let mockChatsService: any;
  let mockMessagesService: any;
  let mockServer: any;

  beforeEach(async () => {
    mockChatsService = {
      getUserChats: jest.fn().mockResolvedValue([]),
      isParticipant: jest.fn().mockResolvedValue(true),
    };

    mockMessagesService = {
      sendMessageWithTranslation: jest.fn().mockResolvedValue({
        id: 42,
        chatId: 7,
        content: 'Тест',
      } as Message),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatsService,
          useValue: mockChatsService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);

    // Мокаем Socket.IO Server
    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
      emit: jest.fn(),
      sockets: {
        sockets: new Map(),
      },
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    // Очищаем таймер heartbeat
    if ((gateway as any).heartbeatInterval) {
      clearInterval((gateway as any).heartbeatInterval);
    }
  });

  it('handleMessageCreated должен отправлять new_message в комнату чата', () => {
    const testMessage = {
      id: 42,
      chatId: 7,
      content: 'Привет через единый поток',
      translateStatus: 'pending',
    } as Message;

    gateway.handleMessageCreated(testMessage);

    expect(mockServer.to).toHaveBeenCalledWith('chat_7');
    const roomEmitter = mockServer.to('chat_7');
    expect(roomEmitter.emit).toHaveBeenCalledWith('new_message', testMessage);
  });

  it('handleSendMessage должен вызывать messagesService.sendMessageWithTranslation', async () => {
    const mockSocket: any = {
      id: 'socket-123',
      emit: jest.fn(),
    };
    (gateway as any).socketToUser.set('socket-123', 10);

    const result = await gateway.handleSendMessage(mockSocket, {
      chatId: 7,
      content: 'Привет',
      sourceLang: 'auto',
      targetLang: 'en',
    });

    expect(mockMessagesService.sendMessageWithTranslation).toHaveBeenCalledWith(
      7,
      10,
      'Привет',
      'auto',
      'en',
    );
    expect(result).toEqual({
      success: true,
      message: expect.objectContaining({ id: 42 }),
    });
  });

  describe('События STT и Summary для участников чата (Задача 5)', () => {
    it('handleMessageTranscribed должен отправлять message_transcribed в комнату чата', () => {
      const payload = {
        messageId: 42,
        chatId: 7,
        transcript: 'Привет, это расшифровка',
        transcriptStatus: 'completed',
      };

      gateway.handleMessageTranscribed(payload);

      expect(mockServer.to).toHaveBeenCalledWith('chat_7');
      const roomEmitter = mockServer.to('chat_7');
      expect(roomEmitter.emit).toHaveBeenCalledWith('message_transcribed', expect.objectContaining({ id: 42, messageId: 42, chatId: 7, transcript: 'Привет, это расшифровка', sttStatus: 'completed' }));
    });

    it('handleMessageVoiceSummary должен отправлять message_voice_summary в комнату чата', () => {
      const payload = {
        messageId: 42,
        chatId: 7,
        summary: 'Краткая выжимка',
        summaryStatus: 'completed',
      };

      gateway.handleMessageVoiceSummary(payload);

      expect(mockServer.to).toHaveBeenCalledWith('chat_7');
      const roomEmitter = mockServer.to('chat_7');
      expect(roomEmitter.emit).toHaveBeenCalledWith('message_voice_summary', expect.objectContaining({ id: 42, messageId: 42, chatId: 7, voiceSummary: 'Краткая выжимка', summary: 'Краткая выжимка', summaryStatus: 'completed' }));
    });
  });

  describe('JWT авторизация и безопасность WebSocket (Задачи 4 и 5)', () => {
    it('handleAuth должен отклонять подключение при невалидном токене', async () => {
      const mockJwtService: any = {
        verify: jest.fn().mockImplementation(() => {
          throw new Error('invalid token');
        }),
      };
      (gateway as any).jwtService = mockJwtService;

      const mockSocket: any = {
        id: 'bad-socket',
        handshake: { address: '127.0.0.1' },
        emit: jest.fn(),
      };

      await gateway.handleAuth(mockSocket, { token: 'invalid_token' });

      expect(mockSocket.emit).toHaveBeenCalledWith('auth_error', {
        message: 'Invalid or expired token',
      });
      expect((gateway as any).socketToUser.has('bad-socket')).toBe(false);
    });

    it('handleAuth должен успешно авторизовать пользователя по валидному JWT токену', async () => {
      const mockJwtService: any = {
        verify: jest.fn().mockReturnValue({ sub: 10, email: 'test@example.com' }),
      };
      (gateway as any).jwtService = mockJwtService;

      const mockSocket: any = {
        id: 'good-socket',
        handshake: { address: '127.0.0.1' },
        emit: jest.fn(),
        join: jest.fn(),
      };

      await gateway.handleAuth(mockSocket, { token: 'Bearer valid_jwt' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth_success',
        expect.objectContaining({ userId: 10 }),
      );
      expect((gateway as any).socketToUser.get('good-socket')).toBe(10);
      expect((gateway as any).userToSocket.get(10)).toBe('good-socket');
    });

    it('handleMessageCreated должен отправлять сообщение через client.to, исключая отправителя', () => {
      const mockSenderSocket: any = {
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      };
      (gateway as any).userToSocket.set(10, 'socket-10');
      mockServer.sockets.sockets.set('socket-10', mockSenderSocket);

      const testMessage = {
        id: 42,
        chatId: 7,
        userId: 10,
        content: 'Привет без дубликатов',
      } as Message;

      gateway.handleMessageCreated(testMessage);

      expect(mockSenderSocket.to).toHaveBeenCalledWith('chat_7');
      const senderRoom = mockSenderSocket.to('chat_7');
      expect(senderRoom.emit).toHaveBeenCalledWith('new_message', testMessage);
      expect(mockServer.to).not.toHaveBeenCalledWith('chat_7');
    });
  });
});
