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
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0f1535] p-1.5 rounded-2xl border border-[#dde4f0] dark:border-[#1e2955]">
        <button
          type="button"
          disabled={disabled}
          onClick={startRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-all"
          title="Записать голос"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span>Записать</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#1a2248] transition-colors"
          title="Выбрать аудиофайл"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span>Файл</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/webm,audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/m4a,.webm,.mp3,.ogg,.wav,.m4a"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="flex-1" />

        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          title="Отмена"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (phase === 'requesting_permission') {
    return (
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-600 dark:text-blue-300">
        <span className="animate-pulse">Запрос доступа к микрофону…</span>
        <button type="button" onClick={cancelRecording} className="text-red-500 font-medium hover:underline">
          Отмена
        </button>
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex items-center justify-between gap-3 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl animate-fade-in shadow-inner">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-6 h-6">
            <span className="absolute w-5 h-5 rounded-full bg-red-500/30 animate-record-pulse" />
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>

          {/* Анимированная звуковая волна голосовой записи */}
          <div className="flex items-center gap-1 h-6 px-1">
            <span className="w-1 bg-red-500 rounded-full animate-wave-bar" style={{ animationDelay: '0ms' }} />
            <span className="w-1 bg-red-500 rounded-full animate-wave-bar" style={{ animationDelay: '150ms' }} />
            <span className="w-1 bg-red-500 rounded-full animate-wave-bar" style={{ animationDelay: '300ms' }} />
            <span className="w-1 bg-red-500 rounded-full animate-wave-bar" style={{ animationDelay: '450ms' }} />
            <span className="w-1 bg-red-500 rounded-full animate-wave-bar" style={{ animationDelay: '600ms' }} />
          </div>

          <span className="font-mono text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">
            {formatDuration(elapsedMs)}
          </span>
          <span className="text-xs text-gray-400">/ 3:00</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={stopRecording}
            className="px-3.5 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-sm transition-all"
          >
            Готово
          </button>
          <button
            type="button"
            onClick={cancelRecording}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title="Отменить запись"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'preview' && draft) {
    return (
      <div className="flex flex-col gap-2.5 p-3 bg-white dark:bg-[#111640] border border-[#dde4f0] dark:border-[#1e2955] rounded-2xl shadow-md w-full">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[#1a2038] dark:text-white truncate max-w-[200px]">
            {draft.source === 'record' ? 'Голосовая запись' : draft.fileName || 'Аудиофайл'}
          </span>
          <span className="font-mono text-[#6070a0] dark:text-[#7b8db5]">
            {formatDuration(draft.durationMs)}
          </span>
        </div>

        <audio src={draft.localUrl} controls className="w-full h-8" preload="metadata" />

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={confirmSend}
            className="flex-1 py-2 px-3 text-xs font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all"
          >
            Отправить
          </button>
          <button
            type="button"
            onClick={discardPreview}
            className="py-2 px-3 text-xs font-medium border border-[#dde4f0] dark:border-[#1e2955] rounded-xl hover:bg-gray-100 dark:hover:bg-[#1a2248] transition-colors"
          >
            Заново
          </button>
          <button
            type="button"
            onClick={cancelRecording}
            className="py-2 px-3 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  // error
  return (
    <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-xs">
      <span className="text-red-500 truncate mr-2">{error || 'Ошибка записи'}</span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setPhase('idle');
          }}
          className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
        >
          Повторить
        </button>
        <button type="button" onClick={cancelRecording} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
    </div>
  );
}
