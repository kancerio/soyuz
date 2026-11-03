'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/voiceUtils';
import { apiClient } from '@/lib/apiClient';

interface AudioPlayerProps {
  /** URL для воспроизведения (blob: или https: /messages/voice/...) */
  src: string | null | undefined;
  /** Длительность из metadata (мс), если известна заранее */
  durationMs?: number | null;
  compact?: boolean;
  className?: string;
}

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

const SKIP_SEC = 5;

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
  /** Реальный src для <audio>: blob после JWT-fetch или исходный blob:/http */
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  const displayDuration = durationMs > 0 ? durationMs : durationMsProp ?? 0;

  // Сброс при смене src + JWT-resolve для /messages/voice/
  useEffect(() => {
    setStatus(src ? 'loading' : 'idle');
    setCurrentMs(0);
    setErrorText(null);
    if (durationMsProp && durationMsProp > 0) {
      setDurationMs(durationMsProp);
    } else {
      setDurationMs(0);
    }

    let revoked: string | null = null;
    let cancelled = false;

    async function resolveSrc() {
      if (!src) {
        setResolvedSrc(null);
        return;
      }

      const isProtected =
        src.includes('/messages/voice/') && !src.startsWith('blob:');

      if (!isProtected) {
        setResolvedSrc(src);
        return;
      }

      const id = src.split('/messages/voice/')[1]?.split('?')[0];
      if (!id) {
        setResolvedSrc(src);
        return;
      }

      try {
        const blob = await apiClient.getVoiceAudio(decodeURIComponent(id));
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setResolvedSrc(url);
      } catch {
        if (!cancelled) {
          setStatus('error');
          setErrorText('Файл недоступен');
          setResolvedSrc(null);
        }
      }
    }

    resolveSrc();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src, durationMsProp]);

  // Подписка на события audio при смене resolvedSrc
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

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
  }, [resolvedSrc]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc || status === 'error') return;

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
  }, [resolvedSrc, status]);

  const seekBy = useCallback(
    (deltaSec: number) => {
      const audio = audioRef.current;
      if (!audio || !resolvedSrc || status === 'error') return;

      const maxSec =
        audio.duration && isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : displayDuration > 0
            ? displayDuration / 1000
            : 0;

      const next = Math.max(0, Math.min(maxSec, audio.currentTime + deltaSec));
      audio.currentTime = next;
      setCurrentMs(Math.round(next * 1000));
    },
    [resolvedSrc, status, displayDuration],
  );

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !displayDuration) return;
    const value = Number(e.target.value);
    audio.currentTime = value / 1000;
    setCurrentMs(value);
  };

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
    <div
      className={`flex items-center gap-2 min-w-0 ${compact ? 'text-sm' : ''} ${className}`}
    >
      <audio
        ref={audioRef}
        src={resolvedSrc ?? undefined}
        preload="metadata"
        className="hidden"
      />

      <button
        type="button"
        onClick={() => seekBy(-SKIP_SEC)}
        disabled={!resolvedSrc}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 text-xs"
        aria-label={`Назад ${SKIP_SEC} секунд`}
        title={`−${SKIP_SEC} с`}
      >
        ⏪
      </button>

      <button
        type="button"
        onClick={togglePlay}
        disabled={!resolvedSrc || (status === 'loading' && currentMs === 0)}
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

      <button
        type="button"
        onClick={() => seekBy(SKIP_SEC)}
        disabled={!resolvedSrc}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 text-xs"
        aria-label={`Вперёд ${SKIP_SEC} секунд`}
        title={`+${SKIP_SEC} с`}
      >
        ⏩
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