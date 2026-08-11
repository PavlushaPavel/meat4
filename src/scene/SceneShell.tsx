import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { sceneUi } from '@/content/scene';
import { calm, dur, tween } from '@/scene/motion';
import { Screen } from '@/ui/CityStage';
import { Button } from '@/ui/Button';
import { Legend } from '@/ui/Plate';
import { haptics } from '@/lib/telegram';
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
/**
 * Насколько сцена приседает под пальцем.
 *
 * ЗАЧЕМ ВООБЩЕ. Тап по сцене — главный жест воронки, ему специально учит
 * подсказка, и до сих пор на него отвечала одна вибрация. Вне Telegram её нет
 * совсем (DESIGN.md §9), а внутри — нет уверенности, что человек её ощутит: на
 * экране не происходило ничего. Следующая реплика не считается ответом, она
 * приходит своим появлением на 300 мс позже и читается как «сцена пошла
 * дальше», а не как «нажатие принято»; на последнем такте лог вообще не
 * меняется, тап только доигрывает сцену.
 *
 * ПОЧЕМУ ПРИСЕДАЕТ ВЕСЬ БЛОК СЦЕНЫ. Кнопка здесь — сама сцена целиком, и
 * отвечать обязан ровно тот объект, который нажали. Вспышка на полосе речи
 * случилась бы в стороне от пальца и читалась бы как событие мира, а не как
 * ответ на прикосновение; приседание одной реплики сообщало бы, что нажали
 * реплику, — а нажали не её, и в момент, когда лога ещё нет, отвечать было бы
 * нечему.
 *
 * ПОЧЕМУ 0.994, А НЕ 0.99. Приседает экран целиком, а не кнопка размером с
 * палец: те же проценты дают здесь ход в разы больше по абсолютной величине.
 * Заметное приседание всего экрана выглядит дёшево и укачивает; 0.6% — это
 * несколько пикселей по верхнему краю, ровно на грани осознания, и это верная
 * граница для подтверждения, которое не должно перебивать рассказ.
 *
 * ТОЧКА ОПОРЫ — НИЗ. Текущая реплика лежит у нижнего края блока и в этот момент
 * её читают. При опоре в центре строка уезжала бы вверх на пару пикселей прямо
 * под взглядом; при опоре в низ она остаётся на месте, а отходит город.
 * Трансформация вёрстку не двигает, поэтому сдвига не будет и у соседей.
 */
const PRESS_SCALE = 0.994;

export function SceneShell<Cue extends string>({
  run,
  total,
  stage,
  cta,
  onCta,
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
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const { index, said, done, advance, finish } = run;

  /**
   * Тап по сцене — жест выбора, а не удара: человек перелистывает мысль, а не
   * запускает событие мира. Отсюда `selectionChanged`, самый тихий отклик из
   * доступных. Вне Telegram вызов молча ничего не делает.
   */
  function tap() {
    haptics.select();
    advance();
  }

  return (
    <Screen className={cn('min-h-dvh justify-between gap-5', className)}>
      <motion.button
        type="button"
        onClick={done ? undefined : tap}
        aria-label={done ? undefined : sceneUi.tapAria}
        aria-disabled={done}
        /**
         * Отклик на нажатие. `whileTap`, а не реакция на `onClick`: ответ обязан
         * прийти на прижатый палец, до того как жест вообще закончится, — иначе
         * это уже не подтверждение, а последствие.
         */
        whileTap={done || reduceMotion ? undefined : { scale: PRESS_SCALE }}
        transition={calm(reduceMotion, tween(dur.press))}
        // Точка опоры — нижний край: см. PRESS_SCALE, реплика под пальцем не
        // должна ездить, пока её читают.
        style={{ transformOrigin: 'bottom' }}
        className="flex flex-1 cursor-default flex-col gap-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-neon/60"
      >
        <div className="relative min-h-[38dvh] shrink-0">{stage}</div>
        <BeatLog said={said} />
      </motion.button>

      <footer className="flex shrink-0 flex-col gap-3">
        <TapHint visible={!done && index < HINT_BEATS} />
        <SceneProgress index={said.length} total={total} done={done} />
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div
              key="cta"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={calm(reduceMotion, tween(dur.base))}
            >
              <Button variant="hazard" onClick={onCta} arrow>
                {cta}
              </Button>
            </motion.div>
          ) : (
            <motion.button
              key="skip"
              type="button"
              onClick={() => {
                haptics.light();
                finish();
              }}
              exit={{ opacity: 0 }}
              className="min-h-11 self-end px-2 text-legend uppercase tracking-legend text-ink-dim transition-colors hover:text-ink"
            >
              {sceneUi.skip}
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
          transition={calm(reduceMotion, tween(dur.base))}
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

/**
 * Сколько тактов держится подсказка про тап.
 *
 * ДВА, А НЕ ВСЮ СЦЕНУ. Подсказка учит одному жесту, и после того как жест
 * понят, она превращается в шум поверх рассказа. Два такта — это примерно
 * десять секунд: достаточно, чтобы заметить, мало, чтобы надоесть. Тот, кто не
 * заметил, ничего не теряет: сцена и так идёт сама, а внизу остаётся
 * «ПРОПУСТИТЬ».
 */
const HINT_BEATS = 2;

/**
 * Подсказка, что по сцене можно тапать.
 *
 * ЗАЧЕМ ОНА ВООБЩЕ НУЖНА. Сцена идёт сама, кнопок на ней нет, и человек
 * физически не может догадаться, что темп в его руках: единственный видимый
 * элемент управления — «ПРОПУСТИТЬ», а он разворачивает всё сразу и потому
 * читается как «сдаться», а не как «чуть быстрее».
 *
 * ПОЧЕМУ ТОЧКА, А НЕ ИКОНКА ПАЛЬЦА. Палец пришлось бы рисовать поверх текста,
 * и он перекрыл бы реплику ровно в тот момент, когда её читают. Пульсирующая
 * точка рядом с подписью говорит то же самое, ничего не закрывая.
 */
function TapHint({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="hint"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={calm(reduceMotion, tween(dur.screen))}
          className="flex items-center gap-2 self-center"
        >
          <motion.span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-neon"
            animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Legend tone="dim">{sceneUi.tapHint}</Legend>
        </motion.div>
      )}
    </AnimatePresence>
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
  const reduceMotion = useReducedMotion();
  const ratio = done ? 1 : Math.min(1, index / total);
  const shown = Math.round(ratio * total);

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line">
        <motion.div
          className="h-px bg-neon"
          animate={{ scaleX: ratio }}
          initial={false}
          style={{ transformOrigin: 'left' }}
          // Единственный `motion.*` во всём проекте, где гейта не было: полоса
          // ползла и у того, кто просил экран не двигать. Значение при
          // `calm()` доезжает мгновенно — состояние верное, движения нет.
          transition={calm(reduceMotion, tween(dur.screen))}
        />
      </div>
      <Legend tone="dim">
        {/**
         * Число не подменяется, а щёлкает: приборные цифры — язык, на котором
         * говорит весь остальной интерфейс, и смена скачком тут выпадает из
         * него. Анимация лежит в `.level-tick` (globals.css), здесь только её
         * перезапуск: CSS-анимация не играет заново на том же узле, поэтому при
         * смене числа меняется `key` и React монтирует новый span. Свой гейт
         * reduced-motion у класса есть — он в том же файле.
         *
         * Тикает только левое число: правое — общий размер сцены, он не меняется
         * никогда, и мигать ему не с чего.
         */}
        <span key={shown} className="level-tick inline-block">
          {String(shown).padStart(2, '0')}
        </span>{' '}
        / {String(total).padStart(2, '0')}
      </Legend>
    </div>
  );
}
