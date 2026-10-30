import { readFileSync } from 'node:fs';
import { HttpService } from '@nestjs/axios';
import { TranslationService } from './translation.service';

jest.setTimeout(180_000);

describe('Live AI provider smoke test (manual only)', () => {
  const service = new TranslationService(
    new HttpService(),
    {
      get: (key: string, fallback?: unknown) => process.env[key] ?? fallback,
    } as any,
    {
      get: async () => null,
      set: async () => true,
    } as any,
  );

  const timed = async <T>(operation: () => Promise<T>) => {
    const started = performance.now();
    const result = await operation();
    return { result, seconds: Number(((performance.now() - started) / 1000).toFixed(2)) };
  };

  it('calls the configured local LLM for translation', async () => {
    const { result, seconds } = await timed(() =>
      service.translate('Доброе утро. Проверяем локальную модель.', 'ru', 'en'),
    );

    expect(result.status).toBe('completed');
    expect(result.translatedText.trim()).not.toBe('');
    expect(result.mock).toBe(false);
    console.log(`real /translate: ${seconds}s; ${result.translatedText}`);
  });

  it('calls the configured local LLM for assist', async () => {
    const { result, seconds } = await timed(() =>
      service.assist('Пришли отчет сегодня, иначе срок сорвется.', 'formal'),
    );

    expect(result.status).toBe('completed');
    expect(result.resultText.trim()).not.toBe('');
    expect(result.mock).toBe(false);
    console.log(`real /assist: ${seconds}s; ${result.resultText}`);
  });

  it('calls the configured local LLM for the shared chat summary contract', async () => {
    const { result, seconds } = await timed(() =>
      service.summarizeMessages(
        [
          { sender_id: 'denis', text: 'Решили проверить локальную модель и Whisper.' },
          { sender_id: 'artem', text: 'Ответственный Денис, срок — сегодня.' },
        ],
        'ru',
      ),
    );

    expect(result.status).toBe('completed');
    expect(result.summary.trim()).not.toBe('');
    expect(result.provider).toBe('lmstudio');
    console.log(`real /summary: ${seconds}s; provider=${result.provider}; ${result.summary}`);
  });

  it('transcribes audio through the configured local Whisper provider', async () => {
    const audioPath = process.env.SOYUZ_STT_SAMPLE;
    if (!audioPath) throw new Error('Set SOYUZ_STT_SAMPLE to a WAV or WebM audio file');
    const audio = readFileSync(audioPath);
    const { result, seconds } = await timed(() =>
      service.transcribeAudio(audio, 'voice.wav', 'audio/wav', 'ru'),
    );

    expect(result.status).toBe('completed');
    expect(result.transcript.trim()).not.toBe('');
    expect(result.provider).toBe('openai_compatible');
    console.log(`real /stt: ${seconds}s; provider=${result.provider}; ${result.transcript}`);
  });
});
