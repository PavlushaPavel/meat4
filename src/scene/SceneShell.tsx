import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { sceneUi } from '@/content/scene';
import { calm, dur, lead, tween } from '@/scene/motion';
import { Screen } from '@/ui/CityStage';
import { Button } from '@/ui/Button';
import { Legend } from '@/ui/Plate';
import { haptics } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import type { Beat } from './beats';
import type { BeatRun } from './useBeats';

/**
 * Каркас сцены, которая идёт сама.
 *
 * КОМПОЗИЦИЯ ПЕРЕСОБРАНА 12.08.2026, и это была не косметика.
 *
 * Прежняя раскладка: кадр сверху на 38% высоты, под ним лог реплик, растущий
 * вниз без ограничений. На бумаге — телесуфлёр. На телефоне — развал:
 *
 *  · к пятому такту страница переставала помещаться в экран;
 *  · новые реплики появлялись НИЖЕ СГИБА, и никто туда не подкручивал;
 *  · город к этому моменту уезжал с экрана совсем.
 *
 * Поверх этого — конкуренция за внимание: кадр и реплика менялись в один момент
 * в разных местах экрана. Глаз может быть только в одном месте, и текст
 * выигрывал всегда — он новый и стоит там, где палец. Смена города происходила
 * вхолостую, то есть половина работы сцены пропадала.
 *
 * ЧЕТЫРЕ РЕШЕНИЯ, КОТОРЫЕ ЭТО ЧИНЯТ:
 *
 *  1. ЭКРАН ФИКСИРОВАННОЙ ВЫСОТЫ. Страница не растёт вообще: кадр закреплён,
 *     речь прокручивается внутри своей области. Это корень поломки.
 *  2. НОВОЕ СВЕРХУ, СТАРОЕ ВНИЗ. Текущая реплика всегда стоит вплотную к нижней
 *     кромке кадра — у взгляда есть постоянная точка приземления, которая не
 *     переезжает по мере сцены. Прошлые уходят вниз и гаснут.
 *  3. РЕПЛИКА ВЫЕЗЖАЕТ ИЗ-ПОД КАДРА: въезжает сверху и в этот момент обрезана
 *     краем области. Текст рождается из города, а не живёт отдельной колонкой.
 *  4. КАДР ИДЁТ ПЕРВЫМ, реплика отстаёт на `lead.cue`. Оба события успевают быть
 *     увиденными, и человеку не приходится выбирать, куда смотреть.
 *
 * СКАЗАННОЕ НЕ ПРОПАДАЕТ: лог прокручивается, и упущенную фразу можно вернуть.
 * Перемотки у сцены нет, поэтому терять реплики нельзя (docs/SPEC.md §2.1).
 */

/**
 * Насколько сцена приседает под пальцем.
 *
 * ЗАЧЕМ ВООБЩЕ. Тап по сцене — главный жест воронки, ему специально учит
 * подсказка, и до этого на него отвечала одна вибрация. Вне Telegram её нет
 * совсем (DESIGN.md §9), а внутри нет уверенности, что человек её ощутит.
 * Следующая реплика ответом не считается: она приходит своим появлением позже и
 * читается как «сцена пошла дальше», а не как «нажатие принято».
 *
 * ПОЧЕМУ 0.994, А НЕ 0.99. Приседает экран целиком, а не кнопка размером с
 * палец: те же проценты дают здесь ход в разы больше по абсолютной величине.
 * Заметное приседание всего экрана выглядит дёшево и укачивает; 0.6% — это
 * несколько пикселей по краю, ровно на грани осознания.
 *
 * ТОЧКА ОПОРЫ — ВЕРХ, и она переехала вместе с композицией. Пока текущая реплика
 * лежала внизу, опора была нижней. Теперь реплика стоит вплотную к кадру
 * сверху, и читают именно её: при опоре в центр или в низ строка уезжала бы под
 * взглядом, при опоре в верх она стоит на месте, а отходит нижний, уже
 * прочитанный край.
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
    <Screen className={cn('h-dvh justify-between gap-4', className)}>
      {/*
        Зона рассказа: кадр и речь. Нажатие живёт здесь, а не на всём экране, —
        иначе тап проходил бы и по главному действию внизу.

        Это `div`, а не `button`, и это вынужденно: внутри лежит прокручиваемая
        область, а фокусируемый узел внутри кнопки — невалидная разметка, которая
        ломает и клавиатуру, и экранного диктора. Клавиатурный эквивалент стоит
        отдельной кнопкой ниже.
      */}
      <motion.div
        onClick={done ? undefined : tap}
        role="presentation"
        /**
         * Отклик на нажатие. `whileTap`, а не реакция на `onClick`: ответ обязан
         * прийти на прижатый палец, до того как жест закончится, — иначе это уже
         * не подтверждение, а последствие.
         */
        whileTap={done || reduceMotion ? undefined : { scale: PRESS_SCALE }}
        transition={calm(reduceMotion, tween(dur.press))}
        style={{ transformOrigin: 'top' }}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        {/*
          Высота кадра считается от экрана, но с потолком и полом: на 360×640
          иначе не остаётся места на речь, а на большом экране кадр раздувается
          в обои. Смысл несёт текст — высоту отдаёт кадр, а не наоборот.
        */}
        <div className="relative h-[clamp(150px,30dvh,260px)] shrink-0">{stage}</div>
        <BeatLog said={said} reduceMotion={Boolean(reduceMotion)} />
      </motion.div>

      <footer className="flex shrink-0 flex-col gap-3">
        {/*
          Клавиатура и экранный диктор: то же действие, что и тап по сцене.
          Видимой кнопки здесь быть не должно — сцена идёт сама, и «дальше» на
          экране вернуло бы механику, от которой ушли (docs/SPEC.md §2.1).
        */}
        {!done && (
          <button type="button" onClick={tap} className="sr-only">
            {sceneUi.tapAria}
          </button>
        )}

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
 * Лог сказанного: новое сверху, старое вниз.
 *
 * ПОРЯДОК ОБРАТЕН ХРОНОЛОГИИ, И ЭТО ГЛАВНОЕ РЕШЕНИЕ КОМПОЗИЦИИ. При обычном
 * порядке текущая реплика уезжала бы всё ниже с каждым тактом, и взгляду
 * пришлось бы догонять её по экрану — именно это и разваливало прежний экран.
 * Здесь она всегда в одной точке, вплотную к кадру.
 *
 * Обрезка сверху ничем не задана специально: область прокрутки сама прячет всё,
 * что выше её края. Поэтому реплика, въезжающая с отрицательным сдвигом, выходит
 * из-под кадра, а не проявляется на месте.
 */
function BeatLog<Cue extends string>({
  said,
  reduceMotion,
}: {
  said: readonly Beat<Cue>[];
  reduceMotion: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const newestId = said[said.length - 1]?.id;

  /**
   * Новая реплика возвращает область в начало. Человек мог уйти вниз читать
   * сказанное раньше — и тогда следующую фразу он бы просто не увидел. Это та же
   * поломка, из-за которой пересобирали композицию, только в миниатюре.
   */
  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [said.length]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={box}
        tabIndex={0}
        aria-live="polite"
        className="flex h-full flex-col gap-3 overflow-y-auto overscroll-contain pb-8 outline-none focus-visible:ring-1 focus-visible:ring-neon/40"
      >
        {[...said].reverse().map((beat) => {
          const isNewest = beat.id === newestId;
          return (
            <motion.div
              key={beat.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={calm(reduceMotion, {
                ...tween(dur.base),
                // Кадр идёт первым, реплика отстаёт. Отставание только у новой:
                // прошлые просто сдвигаются вниз, и ждать им нечего.
                delay: isNewest ? lead.cue : 0,
              })}
              className={cn(
                'flex shrink-0 flex-col gap-2 transition-opacity duration-500',
                isNewest ? 'opacity-100' : 'opacity-35',
              )}
            >
              {beat.say.map((line, j) => (
                <p
                  key={j}
                  className={cn(
                    'text-balance',
                    isNewest ? 'text-lead text-ink' : 'text-base text-ink-dim',
                  )}
                >
                  {line}
                </p>
              ))}
            </motion.div>
          );
        })}
      </div>

      {/*
        Нижняя кромка: сказанное растворяется, а не обрубается. Заодно это
        единственный признак, что ниже есть ещё, — полосы прокрутки в вебвью нет.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-scene to-transparent"
      />
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
  const shown = String(Math.round(ratio * total)).padStart(2, '0');

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line">
        <motion.div
          className="h-px bg-neon"
          animate={{ scaleX: ratio }}
          initial={false}
          style={{ transformOrigin: 'left' }}
          transition={calm(reduceMotion, tween(dur.screen))}
        />
      </div>
      <Legend tone="dim">
        {/*
          Ключ по значению перемонтирует узел, и CSS-анимация щелчка играет
          заново: на том же узле она бы не перезапустилась.
        */}
        <span key={shown} className="level-tick inline-block">
          {shown}
        </span>{' '}
        / {String(total).padStart(2, '0')}
      </Legend>
    </div>
  );
}
