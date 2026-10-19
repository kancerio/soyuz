'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/voiceUtils';

interface AudioPlayerProps {
  /** URL для воспроизведения (blob: или https:) */
  src: string | null | undefined;
  /** Длительность из metadata (мс), если известна заранее */
  durationMs?: number | null;
  /** Компактный вид для карточки */
  compact?: boolean;
  className?: string;
}

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export default function AudioPlayer({
  src,
  durationMs: durationMsProp,
  compact = false,
  className = '',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(durationMsProp ?? 0);
  const [errorText, setErrorText] = useState<string | null>(null);

  // сброс при смене src
  useEffect(() => {
    setStatus(src ? 'loading' : 'idle');
    setCurrentMs(0);
    setErrorText(null);
    if (durationMsProp && durationMsProp > 0) {
      setDurationMs(durationMsProp);
    } else {
      setDurationMs(0);
    }
  }, [src, durationMsProp]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (isFinite(d) && d > 0) {
        setDurationMs(Math.round(d * 1000));
      }
      setStatus((s) => (s === 'playing' ? s : 'ready'));
    };

    const onTimeUpdate = () => {
      setCurrentMs(Math.round(audio.currentTime * 1000));
    };

    const onPlay = () => setStatus('playing');
    const onPause = () => {
      setStatus((s) => (s === 'error' ? s : 'paused'));
    };
    const onEnded = () => {
      setStatus('ready');
      setCurrentMs(0);
      audio.currentTime = 0;
    };
    const onError = () => {
      setStatus('error');
      setErrorText('Файл недоступен');
    };
    const onCanPlay = () => {
      setStatus((s) => (s === 'playing' ? s : 'ready'));
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);

    // перезагрузка src
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [src]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !src || status === 'error') return;

    try {
      if (status === 'playing') {
        audio.pause();
      } else {
        setStatus('loading');
        await audio.play();
      }
    } catch {
      setStatus('error');
      setErrorText('Файл недоступен');
    }
  }, [src, status]);

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !durationMs) return;
    const value = Number(e.target.value);
    audio.currentTime = value / 1000;
    setCurrentMs(value);
  };

  const progress = durationMs > 0 ? Math.min(currentMs / durationMs, 1) : 0;
  const displayDuration = durationMs > 0 ? durationMs : durationMsProp ?? 0;

  if (!src) {
    return (
      <div className={`flex items-center gap-2 text-sm opacity-70 ${className}`}>
        <span>🎤</span>
        <span>Нет аудио</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-red-400">⚠</span>
        <span className="text-red-300">{errorText || 'Файл недоступен'}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 ${compact ? 'text-sm' : ''} ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={togglePlay}
        disabled={status === 'loading' && currentMs === 0}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50"
        aria-label={status === 'playing' ? 'Пауза' : 'Воспроизвести'}
      >
        {status === 'loading' && currentMs === 0 ? (
          <span className="animate-pulse text-xs">…</span>
        ) : status === 'playing' ? (
          <span>⏸</span>
        ) : (
          <span>▶</span>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <input
          type="range"
          min={0}
          max={displayDuration || 1}
          value={Math.min(currentMs, displayDuration || 0)}
          onChange={onSeek}
          disabled={!displayDuration}
          className="w-full h-1.5 accent-white cursor-pointer disabled:opacity-40"
          aria-label="Прогресс"
        />
        <div className="flex justify-between text-[10px] opacity-70 font-mono tabular-nums">
          <span>{formatDuration(currentMs)}</span>
          <span>{formatDuration(displayDuration)}</span>
        </div>
      </div>
    </div>
  );
}