import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Металлическая панель: приборный блок, дверь, стенд, карточка образца.
 * Основная поверхность мира вне карты и вне бумаги.
 */
export function MetalPanel({
  children,
  className,
  rivets = false,
}: {
  children: ReactNode;
  className?: string;
  /** Заклёпки по углам. Только для крупных панелей — на мелких это мусор. */
  rivets?: boolean;
}) {
  return (
    <div
      className={cn(
        'metal-panel rounded-panel border border-line',
        rivets && 'metal-rivets',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Аварийная или разрешающая лампа. Красная мигает (закрыто, брак), зелёная
 * горит ровно (допуск получен), серая потушена (состояние ещё не наступило).
 */
export function Lamp({
  tone,
  label,
  className,
}: {
  tone: 'alarm' | 'ok' | 'off';
  /** Подпись рядом с лампой. Лампа без подписи ничего не сообщает. */
  label: string;
  className?: string;
}) {
  const dot = {
    alarm: 'bg-alarm lamp-alarm shadow-[0_0_10px_var(--color-alarm)]',
    ok: 'bg-neon shadow-[0_0_10px_var(--color-neon)]',
    off: 'bg-metal-hi',
  } as const;

  const text = {
    alarm: 'text-alarm',
    ok: 'text-neon',
    off: 'text-ink-dim',
  } as const;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span aria-hidden="true" className={cn('size-2.5 rounded-full', dot[tone])} />
      <span className={cn('legend', text[tone])}>{label}</span>
    </div>
  );
}
