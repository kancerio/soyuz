'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatDuration,
  getAudioDuration,
  getPreferredMimeType,
  MAX_DURATION_MS,
  validateAudioFile,
} from '@/lib/voiceUtils';

export type VoiceDraft = {
  blob: Blob;
  localUrl: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  source: 'record' | 'upload';
  fileName?: string;
};

type RecorderPhase =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'preview'
  | 'error';

interface VoiceComposerProps {
  disabled?: boolean;
  onReady: (draft: VoiceDraft) => void;
  onCancel: () => void;
}

export default function VoiceComposer({
  disabled = false,
  onReady,
  onCancel,
}: VoiceComposerProps) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokeDraft = useCallback((d: VoiceDraft | null) => {
    if (d?.localUrl) URL.revokeObjectURL(d.localUrl);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      cleanupStream();
      if (mediaRecorderRef.current?.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [clearTimer, cleanupStream]);

  const buildDraftFromUpload = async (
    blob: Blob,
    fileName?: string
  ): Promise<VoiceDraft> => {
    let durationMs = await getAudioDuration(blob);

    if (!durationMs || durationMs <= 0) {
      throw new Error('Не удалось определить длительность');
    }

    if (durationMs > MAX_DURATION_MS) {
      throw new Error('Максимальная длительность — 3 минуты');
    }

    const localUrl = URL.createObjectURL(blob);
    return {
      blob,
      localUrl,
      durationMs,
      mimeType: blob.type || 'audio/webm',
      sizeBytes: blob.size,
      source: 'upload',
      fileName,
    };
  };

  const startRecording = async () => {
    if (disabled) return;
    setError(null);
    setPhase('requesting_permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        clearTimer();
        cleanupStream();

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        const recordedMs = Math.max(0, Date.now() - startTimeRef.current);

        if (blob.size < 100 || recordedMs < 300) {
          setError('Запись слишком короткая');
          setPhase('error');
          return;
        }

        // Для MediaRecorder НЕ вызываем getAudioDuration — webm часто зависает.
        // Длительность берём только с таймера.
        if (recordedMs > MAX_DURATION_MS) {
          setError('Максимальная длительность — 3 минуты');
          setPhase('error');
          return;
        }

        try {
          const localUrl = URL.createObjectURL(blob);
          const d: VoiceDraft = {
            blob,
            localUrl,
            durationMs: recordedMs,
            mimeType: blob.type || mimeType || 'audio/webm',
            sizeBytes: blob.size,
            source: 'record',
          };
          setDraft(d);
          setPhase('preview');
        } catch (err: any) {
          setError(err?.message || 'Ошибка обработки записи');
          setPhase('error');
        }
      };

      recorder.onerror = () => {
        clearTimer();
        cleanupStream();
        setError('Ошибка записи');
        setPhase('error');
      };

      recorder.start(200);
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setPhase('recording');

      timerRef.current = setInterval(() => {
        const ms = Date.now() - startTimeRef.current;
        setElapsedMs(ms);
        if (ms >= MAX_DURATION_MS) {
          if (mediaRecorderRef.current?.state === 'recording') {
            try {
              mediaRecorderRef.current.requestData();
            } catch {
              // ignore
            }
            mediaRecorderRef.current.stop();
          }
        }
      }, 200);
    } catch (err: any) {
      cleanupStream();
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Нет доступа к микрофону'
          : err?.message || 'Не удалось начать запись';
      setError(msg);
      setPhase('error');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      try {
        recorder.requestData();
      } catch {
        // ignore
      }
      recorder.stop();
    } else if (recorder.state === 'inactive') {
      clearTimer();
      cleanupStream();
    }
  };

  const cancelRecording = () => {
    clearTimer();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    }
    cleanupStream();
    chunksRef.current = [];
    revokeDraft(draft);
    setDraft(null);
    setElapsedMs(0);
    setError(null);
    setPhase('idle');
    onCancel();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateAudioFile(file);
    if (validationError) {
      setError(validationError);
      setPhase('error');
      return;
    }

    setError(null);
    try {
      const d = await buildDraftFromUpload(file, file.name);
      revokeDraft(draft);
      setDraft(d);
      setPhase('preview');
    } catch (err: any) {
      setError(err?.message || 'Ошибка чтения файла');
      setPhase('error');
    }
  };

  const confirmSend = () => {
    if (!draft) return;
    onReady(draft);
    setDraft(null);
    setPhase('idle');
    setElapsedMs(0);
  };

  const discardPreview = () => {
    revokeDraft(draft);
    setDraft(null);
    setError(null);
    setPhase('idle');
    setElapsedMs(0);
  };

  if (phase === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={startRecording}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          title="Записать голосовое"
          aria-label="Записать голосовое"
        >
          🎤
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          title="Загрузить аудио"
          aria-label="Загрузить аудио"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/webm,audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/m4a,.webm,.mp3,.ogg,.wav,.m4a"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-red-500 ml-1"
        >
          Отмена
        </button>
      </div>
    );
  }

  if (phase === 'requesting_permission') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
        <span className="animate-pulse">Запрос доступа к микрофону…</span>
        <button type="button" onClick={cancelRecording} className="text-red-500 text-sm">
          Отмена
        </button>
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-3 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-sm tabular-nums">{formatDuration(elapsedMs)}</span>
        <span className="text-xs text-gray-500">/ 3:00</span>
        <button
          type="button"
          onClick={stopRecording}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded-full hover:bg-red-600"
        >
          Стоп
        </button>
        <button
          type="button"
          onClick={cancelRecording}
          className="text-sm text-gray-500 hover:text-red-500"
        >
          Отмена
        </button>
      </div>
    );
  }

  if (phase === 'preview' && draft) {
    return (
      <div className="flex flex-col gap-2 px-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg w-full max-w-md">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {draft.source === 'record' ? 'Запись' : draft.fileName || 'Файл'}
          </span>
          <span className="font-mono text-sm">{formatDuration(draft.durationMs)}</span>
        </div>
        <audio src={draft.localUrl} controls className="w-full h-8" preload="metadata" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmSend}
            className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Отправить
          </button>
          <button
            type="button"
            onClick={discardPreview}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Заново
          </button>
          <button
            type="button"
            onClick={cancelRecording}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-500"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  // error
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-sm">
      <span className="text-red-500">{error || 'Ошибка'}</span>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setPhase('idle');
        }}
        className="text-blue-600 hover:underline"
      >
        Попробовать снова
      </button>
      <button type="button" onClick={cancelRecording} className="text-gray-500">
        Закрыть
      </button>
    </div>
  );
}