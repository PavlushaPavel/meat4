import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { author } from '@/content/author';
import { voiceUi } from '@/content/scene';
import { calm, dur, tween } from '@/scene/motion';
import { cn } from '@/lib/cn';

/**
 * Голосовое сообщение автора — вход в воронку.
 *
 * ФОРМА МЕССЕНДЖЕРА ВЗЯТА НАМЕРЕННО. Прямо перед этим на экране лежит настоящая
 * переписка с клиентом; голосовое приходит в неё же. Это не плеер на странице,
 * а сообщение от человека — и узнаваемость этой формы работает сильнее любой
 * стилизации под мир (docs/SPEC.md §3.3, то же решение, что вывело чат из
 * декораций).
 *
 * ПУЗЫРЬ НЕ ПРИТВОРЯЕТСЯ. Пока записи нет, полоса не бежит по тишине и время не
 * тикает: показывать движение там, где ничего не звучит, — та же ложь, что
 * выдуманный таймкод на несуществующем видео. Кнопка честно говорит, что ведёт
 * дальше без записи.
 */

/** Сколько столбиков в дорожке. Нечётное — у волны есть центр. */
const BARS = 33;

/**
 * Высоты столбиков дорожки.
 *
 * Считаются один раз из индекса, а не случайно: случайная волна перерисовывалась
 * бы на каждый кадр воспроизведения и «кипела» под пальцем. Форма должна быть
 * постоянной — это отпечаток конкретной записи, а не помехи.
 */
const WAVE = Array.from({ length: BARS }, (_, i) => {
  const swell = Math.sin((i / (BARS - 1)) * Math.PI); // тише по краям
  const grain = Math.sin(i * 12.9898) * 43758.5453;
  const jitter = grain - Math.floor(grain);
  return 0.28 + swell * 0.5 + jitter * 0.22;
});

export function VoiceMessage({
  available,
  playing,
  position,
  duration,
  rate,
  onPrimary,
  onSeek,
  onRate,
  className,
}: {
  available: boolean;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  /** Главное действие: начать слушать, поставить на паузу, продолжить. */
  onPrimary: () => void;
  onSeek?: (ratio: number) => void;
  onRate?: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [faceLost, setFaceLost] = useState(false);
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
  const played = available ? ratio : 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={calm(reduceMotion, tween(dur.base))}
      className={cn('flex w-full max-w-[88%] items-start gap-2', className)}
    >
      {/*
        Портрет автора. Не загрузился — на его месте инициалы, а не битая
        иконка и не пустой круг: то же правило, что у карточек образцов
        (docs/SPEC.md §3.7).
      */}
      {faceLost ? (
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-tg-out font-display text-base font-semibold text-tg-ink"
        >
          {initials(author.name)}
        </span>
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}intro/avatar.webp`}
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          onError={() => setFaceLost(true)}
          className="size-10 shrink-0 rounded-full border border-tg-out/60 object-cover"
        />
      )}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-2 rounded-panel bg-tg-in px-3 py-2.5',
          // Пунктир — тот же язык, которым в воронке говорят все неподключённые
          // ссылки: тут будет содержимое, но его пока нет.
          !available && 'border border-dashed border-tg-dim/60',
        )}
      >
        <span className="legend text-tg-dim">{author.mark}</span>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrimary}
            aria-label={label(available, playing)}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-tg-out text-tg-ink transition-transform duration-150 active:scale-95"
          >
            <Glyph playing={available && playing} />
          </button>

          <Wave
            played={played}
            live={available}
            onSeek={available ? onSeek : undefined}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/*
            В пузыре только время. Объяснение, что записи нет, стоит под ним
            один раз: продублированное, оно читается как ошибка вёрстки, а не
            как честное состояние.
          */}
          <span className="legend text-tg-dim">{clock(position || duration)}</span>

          {available && onRate && (
            <button
              type="button"
              onClick={onRate}
              aria-label={voiceUi.rateAria}
              className="legend rounded-plate border border-tg-dim/50 px-1.5 py-0.5 text-tg-dim transition-colors duration-150 active:bg-tg-out/40"
            >
              {rate}×
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Инициалы автора: запасной портрет, если файл не доехал. */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');
}

function label(available: boolean, playing: boolean): string {
  if (!available) return voiceUi.pendingAction;
  if (playing) return voiceUi.pause;
  return voiceUi.play;
}

/** Время в записи: М:СС. Пока метаданных нет, показывать нечего. */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Glyph({ playing }: { playing: boolean }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-[3px]">
      {playing ? (
        <>
          <span className="h-4 w-[3px] rounded-[1px] bg-current" />
          <span className="h-4 w-[3px] rounded-[1px] bg-current" />
        </>
      ) : (
        // Треугольник рисуется рамкой: одна фигура вместо иконочного шрифта и
        // без внешнего файла.
        <span className="ml-0.5 size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
      )}
    </span>
  );
}

/**
 * Дорожка записи. Она же перемотка: столбики — цель достаточно крупная для
 * пальца, отдельного тонкого ползунка тут быть не должно.
 */
function Wave({
  played,
  live,
  onSeek,
}: {
  played: number;
  live: boolean;
  onSeek?: (ratio: number) => void;
}) {
  function seekFrom(event: React.PointerEvent<HTMLDivElement>) {
    if (!onSeek) return;
    const box = event.currentTarget.getBoundingClientRect();
    onSeek((event.clientX - box.left) / box.width);
  }

  return (
    <div
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? voiceUi.seekAria : undefined}
      aria-valuenow={onSeek ? Math.round(played * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={seekFrom}
      className={cn(
        'flex h-9 min-w-0 flex-1 items-center gap-[2px] outline-none',
        onSeek && 'cursor-pointer focus-visible:ring-1 focus-visible:ring-tg-out',
      )}
    >
      {WAVE.map((height, i) => (
        <span
          key={i}
          className={cn(
            'w-full rounded-[1px] transition-colors duration-150',
            live && i / BARS <= played ? 'bg-tg-ink' : 'bg-tg-dim/50',
          )}
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  );
}
