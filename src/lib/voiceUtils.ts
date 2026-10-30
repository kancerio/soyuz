export const SUPPORTED_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp3',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
] as const;

export const MAX_DURATION_MS = 3 * 60 * 1000; // 3 минуты
export const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 50 МБ
export const SUMMARY_MIN_TRANSCRIPT_CHARS = 250;
export const SUMMARY_MIN_DURATION_MS = 60_000;

export function shouldGenerateSummary(
  durationMs: number,
  transcriptLength: number
): boolean {
  return (
    durationMs > SUMMARY_MIN_DURATION_MS ||
    transcriptLength > SUMMARY_MIN_TRANSCRIPT_CHARS
  );
}

export function getPreferredMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
    return 'audio/ogg;codecs=opus';
  }
  return 'audio/webm';
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function isSupportedAudioFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (SUPPORTED_MIME_TYPES.some((t) => type.startsWith(t.split(';')[0]))) {
    return true;
  }
  // fallback по расширению
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['webm', 'mp3', 'ogg', 'wav', 'm4a', 'mp4'].includes(ext || '');
}

export function validateAudioFile(file: File): string | null {
  if (!isSupportedAudioFile(file)) {
    return 'Неподдерживаемый формат. Допустимы: webm, mp3, ogg, wav, m4a';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Файл слишком большой (макс. 50 МБ)';
  }
  return null;
}

/** Получить длительность из blob/file через Audio element */
export function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
      audio.load();
    };

    audio.onloadedmetadata = () => {
      // WebM от MediaRecorder часто отдаёт Infinity — чиним через seek
      if (!isFinite(audio.duration) || audio.duration === Infinity || audio.duration <= 0) {
        audio.currentTime = 1e101;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          const durationMs = Math.round(audio.duration * 1000);
          cleanup();
          if (!isFinite(durationMs) || durationMs <= 0) {
            // последний fallback — вернём 0, caller подставит elapsed
            resolve(0);
            return;
          }
          resolve(durationMs);
        };
        return;
      }

      const durationMs = Math.round(audio.duration * 1000);
      cleanup();
      resolve(durationMs);
    };

    audio.onerror = () => {
      cleanup();
      // не reject — пусть caller использует fallback
      resolve(0);
    };

    audio.src = url;
  });
}