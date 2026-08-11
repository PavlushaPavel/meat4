import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LAB_NAME } from '@/world';

/**
 * Распечатка: лист со стены лаборатории. Единственная светлая поверхность мира
 * и единственное место, где живёт длинное чтение.
 *
 * ПОЧЕМУ БУМАГА, А НЕ ТЁМНЫЙ ЭКРАН: воронку читают с телефона одной рукой,
 * часто в дороге. Три экрана подряд светлым по чёрному — это не стиль, а отказ
 * от чтения. Мир от этого не ломается: распечатки висят на стене лаборатории
 * и в кадре референса (docs/SPEC.md §5.4).
 */
export function Printout({
  children,
  slug,
  className,
}: {
  children: ReactNode;
  /** Машинная шапка листа: номер протокола, дата, отдел. */
  slug?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'paper-sheet relative rounded-plate px-5 py-6 font-body text-paper-ink',
        className,
      )}
      // Лист лежит на столе чуть криво. Один градус, не больше: две степени
      // уже читаются как сломанная вёрстка, а не как физический предмет.
      style={{ transform: 'rotate(-0.35deg)' }}
    >
      {slug && (
        <header className="mb-5 flex items-center justify-between border-b border-dashed border-paper-line pb-2">
          <span className="legend text-paper-ink-dim">{slug}</span>
          <span aria-hidden="true" className="legend text-paper-ink-dim">
            {LAB_NAME}
          </span>
        </header>
      )}
      {children}
    </article>
  );
}
