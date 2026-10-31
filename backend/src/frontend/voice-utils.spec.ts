import {
  formatDuration,
  shouldGenerateSummary,
  validateAudioFile,
} from '../../../src/lib/voiceUtils';

describe('frontend voice utilities', () => {
  it('formats short and multi-minute durations', () => {
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(125_000)).toBe('2:05');
  });

  it('generates a summary only after the duration or transcript threshold', () => {
    expect(shouldGenerateSummary(60_000, 250)).toBe(false);
    expect(shouldGenerateSummary(60_001, 0)).toBe(true);
    expect(shouldGenerateSummary(0, 251)).toBe(true);
  });

  it('accepts supported audio and rejects unsupported or oversized files', () => {
    const audio = (name: string, type: string, size: number) =>
      ({ name, type, size }) as File;

    expect(validateAudioFile(audio('voice.webm', 'audio/webm', 100))).toBeNull();
    expect(validateAudioFile(audio('voice.pdf', 'application/pdf', 100))).toContain(
      'Неподдерживаемый формат',
    );
    expect(validateAudioFile(audio('voice.wav', 'audio/wav', 20 * 1024 * 1024 + 1))).toContain(
      'Файл слишком большой',
    );
  });
});
