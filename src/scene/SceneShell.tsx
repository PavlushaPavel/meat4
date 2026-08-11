import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Screen } from '@/ui/CityStage';
import { Button } from '@/ui/Button';
import { Legend } from '@/ui/Plate';
import { cn } from '@/lib/cn';
import type { Beat } from './beats';
import type { BeatRun } from './useBeats';

/**
 * Каркас сцены, которая идёт сама: сверху город, снизу то, что говорит автор.
 *
 * ПОЧЕМУ ГОРОД СВЕРХУ, А РЕЧЬ СНИЗУ. Большой палец живёт внизу экрана, а
 * иллюстрация должна оставаться видимой, пока текст копится. Обратный порядок
 * заставлял бы город уезжать под клавиатурный край на длинных репликах.
 *
 * ВСЯ СЦЕНА — ОДНА КНОПКА. Тап по ней переводит на следующую реплику, и это
 * единственный способ ускориться, кроме «пропустить». Отдельного «дальше» на
 * каждую мысль здесь нет и быть не должно (docs/SPEC.md §2.1).
 */
export function SceneShell<Cue extends string>({
  run,
  total,
  stage,
  cta,
  onCta,
  skipLabel = 'ПРОПУСТИТЬ',
  className,
}: {
  run: BeatRun<Cue>;
  /** Сколько всего тактов — для полосы прогресса сцены. */
  total: number;
  /** Город: то, что иллюстрирует текущую реплику. */
  stage: ReactNode;
  /** Подпись главного действия, которое появляется, когда сцена договорила. */
  cta: string;
  onCta: () => void;
  skipLabel?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const { said, done, advance, finish } = run;

  return (
    <Screen className={cn('min-h-dvh justify-between gap-5', className)}>
      <button
        type="button"
        onClick={done ? undefined : advance}
        aria-label={done ? undefined : 'Дальше'}
        aria-disabled={done}
        className="flex flex-1 cursor-default flex-col gap-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-neon/60"
      >
        <div className="relative min-h-[38dvh] shrink-0">{stage}</div>
        <BeatLog said={said} />
      </button>

      <footer className="flex shrink-0 flex-col gap-3">
        <SceneProgress index={said.length} total={total} done={done} />
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div
              key="cta"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <Button variant="hazard" onClick={onCta} arrow>
                {cta}
              </Button>
            </motion.div>
          ) : (
            <motion.button
              key="skip"
              type="button"
              onClick={finish}
              exit={{ opacity: 0 }}
              className="min-h-11 self-end px-2 text-legend uppercase tracking-legend text-ink-dim transition-colors hover:text-ink"
            >
              {skipLabel}
            </motion.button>
          )}
        </AnimatePresence>
      </footer>
    </Screen>
  );
}

/**
 * Лог сказанного. Текущая реплика яркая, предыдущие приглушены и остаются на
 * экране: сцена не даёт перемотки, и потерянную фразу вернуть было бы нечем.
 */
function BeatLog<Cue extends string>({ said }: { said: readonly Beat<Cue>[] }) {
  const reduceMotion = useReducedMotion();
  const last = said.length - 1;

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {said.map((beat, i) => (
        <motion.div
          key={beat.id}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex flex-col gap-2 transition-opacity duration-500',
            i === last ? 'opacity-100' : 'opacity-40',
          )}
        >
          {beat.say.map((line, j) => (
            <p
              key={j}
              className={cn(
                'text-balance',
                i === last ? 'text-lead text-ink' : 'text-base text-ink-dim',
              )}
            >
              {line}
            </p>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

/** Полоса сцены: сколько мысли уже прошло. Не прогресс воронки — прогресс речи. */
function SceneProgress({
  index,
  total,
  done,
}: {
  index: number;
  total: number;
  done: boolean;
}) {
  const ratio = done ? 1 : Math.min(1, index / total);
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line">
        <motion.div
          className="h-px bg-neon"
          animate={{ scaleX: ratio }}
          initial={false}
          style={{ transformOrigin: 'left' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <Legend tone="dim">
        {String(Math.round(ratio * total)).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </Legend>
    </div>
  );
}
