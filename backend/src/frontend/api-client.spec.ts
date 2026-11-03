import { apiClient } from '../../../src/lib/apiClient';

describe('frontend API client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uploads voice as multipart data to the authenticated backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 42,
        chatId: 7,
        userId: 3,
        voiceFileId: 'voice-id',
        voiceMimeType: 'audio/webm',
        voiceDuration: 12,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const audio = new Blob(['audio bytes'], { type: 'audio/webm' });

    const result = await apiClient.sendVoiceMessage(7, audio, {
      durationMs: 12_000,
      mimeType: 'audio/webm',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3001/messages/chat/7/voice');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).not.toHaveProperty('Content-Type');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    expect(result).toMatchObject({
      id: 42,
      audioUrl: 'http://localhost:3001/messages/voice/voice-id',
      durationMs: 12_000,
      mimeType: 'audio/webm',
    });
  });

  it('sends translation and chat summary through backend contracts', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translatedText: 'Hello' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: 'Итог', decisions: [], participants: [], language: 'ru', provider: 'lmstudio' }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiClient.translateText('Привет', 'ru', 'en');
    await apiClient.summarizeMessages('ru', [
      { sender_id: 'user-1', text: 'Обсудили задачу', timestamp: '2026-10-20T12:00:00.000Z' },
    ]);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3001/messages/translate');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      text: 'Привет',
      source_lang: 'ru',
      target_lang: 'en',
    });
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3001/messages/summary');
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      language: 'ru',
      messages: [{ sender_id: 'user-1', text: 'Обсудили задачу', timestamp: '2026-10-20T12:00:00.000Z' }],
    });
  });

  it('sends a selected audio file to backend Whisper endpoint as multipart', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: 'Распознано', language: 'ru', status: 'completed' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const audio = new Blob(['voice'], { type: 'audio/wav' });

    const result = await apiClient.transcribeAudio(audio, 'ru');

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3001/messages/transcribe');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Content-Type');
    expect(result.transcript).toBe('Распознано');
  });
});
