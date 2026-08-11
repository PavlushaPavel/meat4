import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { audienceScene } from '@/content/city';
import { prevStep, type StepKey } from '@/router/flow';
import { useNav } from '@/router/useNav';
import { SceneShell } from '@/scene/SceneShell';
import { calm, dur, tween } from '@/scene/motion';
import { useBeats } from '@/scene/useBeats';
import { useFunnel } from '@/store/funnel';
import { ConversionChain } from '@/ui/ConversionChain';
import { MetalPanel } from '@/ui/MetalPanel';
import { Legend } from '@/ui/Plate';
import { haptics } from '@/lib/telegram';

/**
 * Шаг 4. Пятнадцать секунд города между первой и второй главой.
 *
 * ЧТО ЭТО ЗА ЭКРАН. Не глава и не вывод, а НАГРАДА: человек досмотрел первое
 * видео, и город возвращается ровно затем, чтобы показать последствие. В
 * будущую связку физически встаёт первая деталь, участок АУДИТОРИЯ загорается,
 * автор двумя фразами разворачивает человека во вторую главу. Четырнадцать
 * секунд, одна кнопка, ни одного абзаца сверх этого (`src/content/city.ts`).
 *
 * ПОЧЕМУ ЭТО СЦЕНА, А НЕ СТРАНИЦА С КНОПКОЙ. Прежняя воронка после каждой
 * мысли ставила «дальше», и награда превращалась в ещё одно нажатие. Здесь
 * сцена идёт сама (`useBeats`), а нажать нужно ровно один раз — в конце.
 */
export function AudienceScreen() {
  const { step, next } = useNav();
  const assemble = useFunnel((s) => s.assemble);
  const run = useBeats(audienceScene.beats);

  // Деталь встала на место и участок загорелся.
  const landed = run.index >= INSERT_AT;
  // Прибор подтвердил: AUDIENCE ✓. Отдельным тактом позже, чем само событие.
  const confirmed = run.index >= LIT_AT;

  /**
   * Артефакт записывается в стор В МОМЕНТ ПОСАДКИ ДЕТАЛИ, а не при входе на
   * шаг: `store/funnel.ts` держит `artifacts` отдельно от маршрута именно
   * потому, что сборка происходит внутри такта. Эффект идемпотентен —
   * `assemble` игнорирует повтор, — поэтому лишний вызов при перерисовке
   * ничего не портит.
   *
   * При `prefers-reduced-motion` `useBeats` сразу отдаёт последний такт, флаг
   * поднимается на первом же кадре, и деталь оказывается собрана — порядок
   * событий сохранён, ожидание убрано.
   */
  useEffect(() => {
    if (!landed) return;
    assemble('audience');
    // Деталь садится в связку — единственный удар этой сцены. Он совпадает с
    // движением на экране, а не с нажатием: человек в этот момент ничего не
    // трогает, и отклик работает как звук встающей на место детали.
    haptics.medium();
  }, [landed, assemble]);

  /**
   * Карта связки НИЧЕГО НЕ РЕШАЕТ САМА: она рисует состояние участков по шагу
   * (`zoneState`). А на этом шаге участок АУДИТОРИЯ уже открыт по расписанию —
   * то есть, отдай мы `ConversionChain` текущий шаг с самого начала, человек
   * приехал бы на готовую картинку и посадки детали не увидел бы вовсе.
   *
   * Поэтому до посадки карте отдаётся ПРЕДЫДУЩИЙ шаг маршрута: там участок
   * ещё серый. Это не флаг «открыто» в обход расписания и не второе место, где
   * решается состояние карты, — это выбор между двумя точками одного и того же
   * расписания. Забыть открыть участок по-прежнему невозможно: после посадки
   * карта переключается на текущий шаг и берёт состояние оттуда.
   */
  const before = prevStep(step) ?? step;

  return (
    <SceneShell
      run={run}
      total={audienceScene.beats.length}
      cta={audienceScene.cta}
      onCta={next}
      stage={<AssemblyStage step={landed ? step : before} landed={landed} confirmed={confirmed} />}
    />
  );
}

/**
 * Индексы тактов, на которых происходят события сцены. Считаются из сценария
 * по подсказке, а не проставлены числами: такт можно переписать или добавить,
 * и порядок событий поедет вместе с ним сам.
 */
const INSERT_AT = audienceScene.beats.findIndex((b) => b.cue === 'insert');
const LIT_AT = audienceScene.beats.findIndex((b) => b.cue === 'lit');

/**
 * Город на сцене: слот с деталью над связкой и сама связка.
 *
 * Слот — фиксированной высоты, и это важно: в нём последовательно живут три
 * состояния (деталь → пусто → подтверждение), и прыгающая карта под ними
 * читалась бы как сбой вёрстки, а не как событие.
 */
function AssemblyStage({
  step,
  landed,
  confirmed,
}: {
  step: StepKey;
  landed: boolean;
  confirmed: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-11 items-center">
        <AnimatePresence mode="wait" initial={false}>
          {!landed && (
            // Деталь уходит ВНИЗ, в связку, а не растворяется на месте: это
            // единственный кадр всей сцены, ради которого она снята.
            <motion.div
              key="part"
              initial={false}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.96 }}
              transition={calm(reduceMotion, tween(dur.screen))}
            >
              <MetalPanel className="flex items-center gap-3 px-3 py-1.5">
                <Legend tone="dim">{audienceScene.slot}</Legend>
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
                  {audienceScene.part}
                </span>
              </MetalPanel>
            </motion.div>
          )}

          {confirmed && (
            <motion.div
              key="lit"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={calm(reduceMotion, tween(dur.base))}
            >
              <Legend tone="neon">{audienceScene.lit}</Legend>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Плотный вид: на сцене мало места, подписи участков здесь лишние. */}
      <ConversionChain step={step} dense />
    </div>
  );
}
