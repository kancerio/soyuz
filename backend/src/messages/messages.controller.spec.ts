import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ChatsService } from '../chats/chats.service';
import { BadRequestException } from '@nestjs/common';

describe('MessagesController', () => {
  let controller: MessagesController;
  let messagesService: Record<string, jest.Mock>;

  beforeEach(async () => {
    messagesService = {
      getChatMessages: jest.fn(),
      sendMessageWithTranslation: jest.fn(),
      sendVoiceMessage: jest.fn(),
      getVoiceFile: jest.fn(),
      assist: jest.fn(),
      translateText: jest.fn(),
      summarizeMessages: jest.fn(),
      transcribeAudio: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: messagesService,
        },
        {
          provide: ChatsService,
          useValue: {
            getUserRole: jest.fn(),
            isParticipant: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('routes text translation to the backend AI service', async () => {
    const body = { text: 'Привет', source_lang: 'ru', target_lang: 'en' };
    messagesService.translateText.mockResolvedValue({ translatedText: 'Hello' });

    await expect(controller.translate(body)).resolves.toEqual({ translatedText: 'Hello' });
    expect(messagesService.translateText).toHaveBeenCalledWith('Привет', 'ru', 'en');
  });

  it('routes chat summaries using the shared message contract', async () => {
    const body = {
      language: 'ru',
      messages: [{ sender_id: '5', text: 'Обсудили сроки' }],
    };
    messagesService.summarizeMessages.mockResolvedValue({ summary: 'Итог' });

    await expect(controller.summarize(body)).resolves.toEqual({ summary: 'Итог' });
    expect(messagesService.summarizeMessages).toHaveBeenCalledWith(body.messages, 'ru');
  });

  it('rejects a missing transcription file instead of returning a mock transcript', async () => {
    await expect(controller.transcribeAudio(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(messagesService.transcribeAudio).not.toHaveBeenCalled();
  });
});
