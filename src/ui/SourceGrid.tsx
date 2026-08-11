import { motion, useReducedMotion } from 'motion/react';
import { HOME_SOURCE, SOURCES, type SourceId } from '@/world';
import { calm, dur, stagger, tween } from '@/scene/motion';
import { Legend } from '@/ui/Plate';
import { cn } from '@/lib/cn';

/**
 * Районы трафика на карте: плитки, которые загораются по очереди.
 *
 * ЭТО НЕ ВЫБОР И НЕ МЕНЮ. Плитки ничего не переключают: человек воронки живёт в
 * `HOME_SOURCE` от первой строки до последней, а соседние районы — то, чему
 * можно доучиться. Поэтому здесь нет ни `onClick`, ни выделенного состояния
 * «выбрано»: есть «уже горит» и «ещё нет».
 *
 * ПОЧЕМУ ДОМАШНИЙ РАЙОН ВЫГЛЯДИТ ИНАЧЕ. Загоревшийся соседний район — это
 * знание, которое можно купить; загоревшийся домашний — то, что у человека уже
 * есть. Неон в этом мире означает ровно второе (docs/SPEC.md §5.2), поэтому
 * светится только он, а соседи получают обычную кромку металла. Если бы горели
 * все четыре одинаково, сцена пообещала бы, что все четыре района уже твои.
 *
 * СОСТАВ И ИМЕНА ПЛИТОК НЕ ЗАДАЮТСЯ ПРОПСОМ: они берутся из `SOURCES`, потому
 * что это карта мира, а не копирайт экрана. Снаружи приходит только то, какие
 * из них уже зажглись.
 */
export function SourceGrid({
  lit,
  homeLabel,
  className,
}: {
  /** Какие районы уже загорелись. Порядок задаёт очередь загорания. */
  lit: readonly SourceId[];
  /** Подпись домашней плитки. Приходит из контента: в компоненте текста нет. */
  homeLabel?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <ul className={cn('grid grid-cols-2 gap-2', className)}>
      {SOURCES.map((source) => {
        const order = lit.indexOf(source.id);
        const on = order >= 0;
        const home = source.id === HOME_SOURCE.id;

        return (
          <motion.li
            key={source.id}
            // `initial={false}`: при возврате на такт назад плитки не должны
            // зажигаться заново — они уже горели, и повтор читался бы как сбой.
            initial={false}
            animate={{ opacity: on ? 1 : 0.3, scale: on ? 1 : 0.97 }}
            transition={calm(reduceMotion, {
              ...tween(dur.screen),
              // Очередь загорания живёт в задержке, а не в отдельном таймере:
              // порядок в `lit` — единственный источник правды о ней.
              delay: on ? order * stagger.reveal : 0,
            })}
            className={cn(
              'flex min-h-20 flex-col justify-between gap-2 rounded-panel border p-2.5',
              on && home && 'neon-edge',
              on && !home && 'border-line bg-scene-deep/60',
              !on && 'border-line/50',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  'font-display text-sm font-semibold uppercase leading-tight tracking-wide',
                  on && home ? 'text-neon' : on ? 'text-ink' : 'text-ink-dim',
                )}
              >
                {source.name}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'legend shrink-0 rounded-plate border px-1.5 py-0.5',
                  on && home ? 'border-neon/60 text-neon' : 'border-line text-ink-dim',
                )}
              >
                {source.glyph}
              </span>
            </div>

            <Legend tone={on && home ? 'neon' : 'dim'}>
              {home && homeLabel ? homeLabel : source.channel}
            </Legend>
          </motion.li>
        );
      })}
    </ul>
  );
}
