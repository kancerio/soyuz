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
});
