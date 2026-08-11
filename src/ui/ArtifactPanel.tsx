import type { ExternalAction } from '@/content/types';
import { ExternalButton } from '@/ui/ExternalButton';
import { cn } from '@/lib/cn';

/**
 * Карточка артефакта: что лежит в проекте.
 *
 * ЗАЧЕМ ОНА ВООБЩЕ СУЩЕСТВУЕТ. Это главный носитель мысли всей конструкции:
 * результат предыдущего этапа становится сырьём следующего. Вторая глава
 * начинается не с нуля — в ней уже лежит исследование из первой; третья
 * получает исследование и офферы разом и ничего не объясняет заново. Если эту
 * передачу не показать предметом, останется утверждение «всё связано», которому
 * человек не обязан верить.
 *
 * Отсюда два вида одной карточки, а не два разных компонента:
 *
 *  `carried` — «это уже лежит в проекте». Стоит в начале главы, компактная,
 *              в две колонки: она напоминает, а не объявляет.
 *  `output`  — «это ты только что получил». Стоит в конце, крупная, с именем
 *              артефакта и кнопкой наружу. Её человек и уносит дальше.
 *
 * Одинаковый материал у обоих видов обязателен: человек должен узнать в начале
 * второй главы ровно тот предмет, который получил в конце первой.
 *
 * Мира здесь нет намеренно: акт обучения выпадает из города, поэтому ни неона,
 * ни металла, ни жёлтой ленты — тонкая линия и текст.
 */
export function ArtifactPanel({
  variant,
  caption,
  title,
  lines,
  note,
  action,
  className,
}: {
  variant: 'carried' | 'output';
  /** Подпись сверху: «Уже в проекте» / «Результат главы». */
  caption: string;
  /** Имя артефакта. У `carried` его нет: там может лежать сразу несколько. */
  title?: string;
  lines: readonly string[];
  /** Реплика автора под списком. Только у результата. */
  note?: string;
  action?: ExternalAction;
  className?: string;
}) {
  const isOutput = variant === 'output';

  return (
    <section
      className={cn(
        'rounded-panel border border-line',
        // Результат главы заметно плотнее и с бликом по верхней кромке —
        // предмет, а не сноска.
        isOutput ? 'bg-scene-deep/70 p-5' : 'bg-scene-deep/40 p-4',
        className,
      )}
      // Блик задан стилем, а не утилитой: `color-mix` внутри произвольного
      // значения тени — ровно то место, где Tailwind молча отдаёт пустое
      // правило, а сборка при этом остаётся зелёной.
      style={
        isOutput
          ? {
              boxShadow: 'inset 0 1px 0 color-mix(in oklab, #fff 8%, transparent)',
            }
          : undefined
      }
    >
      <p className="legend text-ink-dim">{caption}</p>

      {title && (
        <h2 className="mt-2 font-display text-title font-semibold uppercase leading-none tracking-tight text-ink">
          {title}
        </h2>
      )}

      <ul
        className={cn(
          'mt-3',
          // Опись из тринадцати строк (третья глава несёт оба предыдущих
          // артефакта) в одну колонку читается как простыня. В две — как опись.
          isOutput ? 'space-y-2' : 'grid gap-x-4 gap-y-1.5 sm:grid-cols-2',
        )}
      >
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'shrink-0 leading-relaxed',
                isOutput ? 'text-ink' : 'text-ink-dim',
              )}
            >
              ✓
            </span>
            <span
              className={cn(
                'leading-relaxed',
                isOutput ? 'text-base text-ink' : 'text-small text-ink-dim',
              )}
            >
              {line}
            </span>
          </li>
        ))}
      </ul>

      {note && <p className="mt-4 text-base leading-relaxed text-ink-dim">{note}</p>}

      {/*
        Ссылок на ассистентов и на собранную страницу пока не существует.
        `ExternalButton` сам покажет честное неактивное состояние с подписью,
        почему — исчезать кнопке нельзя, иначе человек не узнает, что предмет
        вообще выдаётся наружу (docs/SPEC.md §3.7).
      */}
      {action && <ExternalButton action={action} className="mt-4" />}
    </section>
  );
}
