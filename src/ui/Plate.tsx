import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Жёлтая табличка промзоны: TRAFFIC LAB, ДОПУСК, ASSEMBLY ROOM, ПАРТИЯ НЕ ПРОШЛА.
 *
 * Ставится там, где по смыслу опасно или закрыто. Если развесить её на каждом
 * экране, она перестанет означать опасность (docs/SPEC.md §5.3).
 */
export function Plate({
  children,
  className,
  worn = true,
}: {
  children: ReactNode;
  className?: string;
  /** Потёртая краска по краям. Выключается там, где табличка новая. */
  worn?: boolean;
}) {
  return (
    <div className={cn('relative inline-flex flex-col', className)}>
      <div
        aria-hidden="true"
        className={cn('h-2.5 w-full', worn ? 'hazard-worn' : 'hazard-tape')}
      />
      <div className="bg-hazard px-4 py-2.5 text-on-hazard">{children}</div>
      <div
        aria-hidden="true"
        className={cn('h-2.5 w-full', worn ? 'hazard-worn' : 'hazard-tape')}
      />
    </div>
  );
}

/** Полоса опасной ленты без содержимого — разделитель акта. */
export function TapeStrip({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('hazard-worn h-3 w-full', className)} />;
}

/**
 * Трафаретная подпись прибора: номер, статус, координаты. Моноширинный капс —
 * это язык, на котором в этом мире говорят приборы, а не автор.
 */
export function Legend({
  children,
  tone = 'dim',
  className,
}: {
  children: ReactNode;
  tone?: 'dim' | 'ink' | 'neon' | 'alarm' | 'hazard';
  className?: string;
}) {
  const tones = {
    dim: 'text-ink-dim',
    ink: 'text-ink',
    neon: 'text-neon',
    alarm: 'text-alarm',
    hazard: 'text-hazard',
  } as const;

  return <p className={cn('legend', tones[tone], className)}>{children}</p>;
}
