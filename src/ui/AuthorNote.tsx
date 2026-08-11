import type { ReactNode } from 'react';
import { author } from '@/content/author';
import { cn } from '@/lib/cn';
import { Legend } from './Plate';

/**
 * Реплика автора.
 *
 * ОДНА ФОРМА НА ВСЕ ШЕСТЬ КАСАНИЙ — в этом весь смысл. Человек проходит
 * тридцать один экран; если голос автора каждый раз выглядит иначе, он не
 * складывается в одного человека. Одинаковая врезка с подписью работает как
 * узнавание: увидел кромку и уже знаешь, кто говорит.
 *
 * Форма тихая сознательно: тонкая неоновая кромка слева и подпись легендой.
 * Ни портрета, ни плашки, ни цитатных кавычек — воронка обучающая, автор в ней
 * появляется, а не занимает её (решение заказчика 09.08.2026).
 */
export function AuthorNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn('border-l-2 border-neon/60 pl-4', className)}>
      <Legend className="text-neon">{author.mark}</Legend>
      <div className="mt-2 space-y-2">{children}</div>
    </aside>
  );
}

/** Абзац внутри реплики. Ритм тот же, что во всём длинном чтении. */
export function AuthorLine({ children }: { children: ReactNode }) {
  return <p className="text-base leading-relaxed text-ink">{children}</p>;
}
