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
  isOwn?: boolean;
  className?: string;
}

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

const SKIP_SEC = 5;

// Генерация высоты столбиков волны псевдо-случайно на основе длительности
function generateWaveBars(count = 28) {
  const bars = [];
  for (let i = 0; i < count; i++) {
    // гармоническая кривая волны
    const sinVal = Math.sin((i / count) * Math.PI * 3.5);
    const height = Math.max(20, Math.min(100, Math.floor(Math.abs(sinVal) * 80 + (i % 3) * 10 + 15)));
    bars.push(height);
  }
  return bars;
}

export default function AudioPlayer({
  src,
  durationMs: durationMsProp,
  compact = false,
  isOwn = false,
  className = '',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(durationMsProp ?? 0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [waveBars] = useState(() => generateWaveBars(compact ? 20 : 32));

  const displayDuration = durationMs > 0 ? durationMs : durationMsProp ?? 0;
  const progressRatio = displayDuration > 0 ? Math.min(1, currentMs / displayDuration) : 0;

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

  // Подписка на события audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (isFinite(d) && d > 0) {
        setDurationMs(Math.round(d * 1000));
      }
      setStatus('ready');
    };

    const onTimeUpdate = () => {
      setCurrentMs(Math.round(audio.currentTime * 1000));
    };

    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus('paused');
    const onEnded = () => {
      setStatus('ready');
      setCurrentMs(0);
    };
    const onError = () => {
      setStatus('error');
      setErrorText('Ошибка воспроизведения');
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [resolvedSrc]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    if (status === 'playing') {
      audio.pause();
    } else {
      audio.play().catch(() => {
        setStatus('error');
        setErrorText('Воспроизведение заблокировано');
      });
    }
  }, [resolvedSrc, status]);

  const seekBy = useCallback(
    (deltaSec: number) => {
      const audio = audioRef.current;
      if (!audio || !resolvedSrc) return;
      const target = Math.max(0, Math.min(audio.currentTime + deltaSec, (displayDuration || 0) / 1000));
      audio.currentTime = target;
      setCurrentMs(Math.round(target * 1000));
    },
    [resolvedSrc, displayDuration]
  );

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !displayDuration) return;
    const value = Number(e.target.value);
    audio.currentTime = value / 1000;
    setCurrentMs(value);
  };

  const handleWaveClick = (index: number, total: number) => {
    const audio = audioRef.current;
    if (!audio || !displayDuration) return;
    const ratio = index / total;
    const targetMs = ratio * displayDuration;
    audio.currentTime = targetMs / 1000;
    setCurrentMs(targetMs);
  };

  if (!src) {
    return (
      <div className={`flex items-center gap-2 text-xs opacity-70 ${className}`}>
        <span>🎤</span>
        <span>Нет аудиозаписи</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex items-center gap-2 text-xs p-2 rounded-xl bg-red-500/10 text-red-400 ${className}`}>
        <span>⚠</span>
        <span>{errorText || 'Файл недоступен'}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 select-none min-w-[220px] sm:min-w-[260px] ${className}`}>
      <audio
        ref={audioRef}
        src={resolvedSrc ?? undefined}
        preload="metadata"
        className="hidden"
      />

      {/* Кнопка Play/Pause */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!resolvedSrc || (status === 'loading' && currentMs === 0)}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 disabled:opacity-50 ${
          isOwn
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
        }`}
        aria-label={status === 'playing' ? 'Пауза' : 'Воспроизвести'}
      >
        {status === 'loading' && currentMs === 0 ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : status === 'playing' ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3.868v16.264c0 .822.894 1.332 1.606.915l13.553-8.132a1.066 1.066 0 000-1.83L6.606 2.953C5.894 2.536 5 3.046 5 3.868z" />
          </svg>
        )}
      </button>

      {/* Звуковая волна / прогресс и таймер */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        {/* Волна звуковых столбиков */}
        <div className="flex items-center gap-1 h-7 cursor-pointer py-1" title="Перемотка">
          {waveBars.map((barHeight, idx) => {
            const barRatio = idx / waveBars.length;
            const isPlayed = barRatio <= progressRatio;

            return (
              <div
                key={idx}
                onClick={() => handleWaveClick(idx, waveBars.length)}
                style={{ height: `${barHeight}%` }}
                className={`flex-1 min-w-[2px] rounded-full transition-all duration-100 ${
                  isOwn
                    ? isPlayed
                      ? 'bg-white opacity-100'
                      : 'bg-white/35 hover:bg-white/60'
                    : isPlayed
                    ? 'bg-blue-600 dark:bg-blue-400 opacity-100'
                    : 'bg-gray-300 dark:bg-[#253265] hover:bg-gray-400'
                }`}
              />
            );
          })}
        </div>

        {/* Скрытый диапазон для доступности */}
        <input
          type="range"
          min={0}
          max={displayDuration || 1}
          value={Math.min(currentMs, displayDuration || 0)}
          onChange={onSeek}
          disabled={!displayDuration}
          className="sr-only"
          aria-label="Прогресс воспроизведения"
        />

        {/* Время: текущее / общее */}
        <div
          className={`flex items-center justify-between text-[11px] font-mono tabular-nums leading-none ${
            isOwn ? 'text-white/80' : 'text-[#6070a0] dark:text-[#7b8db5]'
          }`}
        >
          <span>{formatDuration(currentMs)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => seekBy(-SKIP_SEC)}
              disabled={!resolvedSrc}
              className="hover:opacity-100 opacity-60 text-[10px]"
              title="Назад на 5 секунд"
            >
              -5с
            </button>
            <button
              type="button"
              onClick={() => seekBy(SKIP_SEC)}
              disabled={!resolvedSrc}
              className="hover:opacity-100 opacity-60 text-[10px]"
              title="Вперед на 5 секунд"
            >
              +5с
            </button>
            <span>{formatDuration(displayDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
