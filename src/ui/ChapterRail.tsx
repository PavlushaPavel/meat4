import type { StepKey } from '@/router/flow';
import { cn } from '@/lib/cn';

/** Одна отметка в полосе. Номер не хранится: он равен позиции в списке. */
export interface ChapterMark {
  step: StepKey;
  /** Короткое имя главы: «Аудитория». Приходит из `src/content/lessons.ts`. */
  short: string;
}

/**
 * Полоса глав над плеером: 1. Аудитория → 2. Оффер → 3. Посадка.
 *
 * ЧТО ЭТО ТАКОЕ И ЧЕМ НЕ ЯВЛЯЕТСЯ. Это ОГЛАВЛЕНИЕ КУРСА, а не прибор мира.
 * Индикатор прогресса в воронке ровно один — карта города (docs/SPEC.md §1.1),
 * и второй бы у неё этот смысл отобрал. Здесь человек сел смотреть обучение, и
 * ему нужно только одно: понимать, какая из трёх глав идёт и сколько осталось.
 *
 * Отсюда все решения формы: ни шкалы, ни процентов, ни заливки, ни неона, ни
 * жёлтой ленты. Текущая глава просто светлее остальных и подчёркнута, а
 * пройденные отмечены галочкой. Заказчик просил «сверху небольшой прогресс» —
 * ключевое слово «небольшой».
 *
 * Полоса ничего не решает сама: и текущая глава, и список пройденных приходят
 * пропсами от экрана, который знает шаг маршрута.
 */
export function ChapterRail({
  chapters,
  current,
  done,
  ariaLabel,
  doneLabel,
  className,
}: {
  chapters: readonly ChapterMark[];
  /** Шаг текущей главы. */
  current: StepKey;
  /** Шаги уже пройденных глав. */
  done: readonly StepKey[];
  /** Имя полосы для скринридера. */
  ariaLabel: string;
  /** Чем галочка подписана для скринридера: сам знак ничего не произносит. */
  doneLabel: string;
  className?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cn('w-full', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {chapters.map((chapter, i) => {
          const isCurrent = chapter.step === current;
          const isDone = done.includes(chapter.step);

          return (
            <li key={chapter.step} className="flex items-center gap-2">
              <span
                // `aria-current="step"` — единственная разметка состояния,
                // которая понятна вспомогательным технологиям. Цвет и
                // подчёркивание для них не существуют.
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'inline-flex items-baseline gap-1.5 border-b-2 pb-1 font-display text-small tracking-wide transition-colors',
                  isCurrent
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-dim',
                )}
              >
                <span aria-hidden="true" className="tabular-nums">
                  {i + 1}.
                </span>
                <span>{chapter.short}</span>
                {isDone && (
                  <>
                    <span aria-hidden="true" className="text-base leading-none">
                      ✓
                    </span>
                    <span className="sr-only">{doneLabel}</span>
                  </>
                )}
              </span>

              {i < chapters.length - 1 && (
                <span aria-hidden="true" className="text-ink-dim/50">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
