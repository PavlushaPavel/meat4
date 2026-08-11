import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { conversion, conversionBeats, type ConversionCue } from '@/content/preframe';
import { SceneShell } from '@/scene/SceneShell';
import { calm, dur, ease, stagger, tween } from '@/scene/motion';
import { useBeats } from '@/scene/useBeats';
import { useNav } from '@/router/useNav';
import { ConversionChain } from '@/ui/ConversionChain';
import { SourceGrid } from '@/ui/SourceGrid';
import { MetalPanel } from '@/ui/MetalPanel';
import { CHAIN, HOME_SOURCE, SOURCES, type Source } from '@/world';
import { cn } from '@/lib/cn';

/**
 * Состояние 2. Подъём в Conversion District.
 *
 * СЦЕНА ДЕРЖИТСЯ НА ОДНОМ ЖЕСТЕ КАМЕРЫ, и он же — вся мысль воронки:
 * вбок (районов может быть сколько угодно) → вниз, в одну точку (а приезжают
 * все примерно сюда) → вверх (и вот здесь решается, станут ли они деньгами).
 * Расширение инструментария выглядит победой ровно до того кадра, где дороги
 * сходятся: потолок обнаруживается не в словах, а в геометрии.
 *
 * Здесь ставится Big Domino — «два специалиста одинаково знают Директ, но
 * продают работу за разные деньги». Всё, что человек увидит дальше, объясняет
 * именно эту фразу, поэтому она получает два последних такта и свой кадр.
 */
export function ConversionScreen() {
  const { next } = useNav();
  const run = useBeats(conversionBeats);

  return (
    <SceneShell
      run={run}
      total={conversionBeats.length}
      stage={<ConversionStage index={run.index} cue={run.current.cue} />}
      cta={conversion.cta}
      onCta={next}
    />
  );
}

/** См. тот же приём в `PreframeScreen`: сколько тактов подсказки уже прошло. */
function cueOrdinal(index: number, cue: ConversionCue): number {
  let n = -1;
  for (let i = 0; i <= index; i++) {
    if (conversionBeats[i].cue === cue) n++;
  }
  return Math.max(0, n);
}

/**
 * Кадры сцены. Две пары подсказок делят один кадр намеренно:
 *
 *  · `client` и `converge` — это ОДНИ И ТЕ ЖЕ дороги, у которых меняется
 *    только точка схода. Если перерисовать кадр целиком, пропадёт сам довод:
 *    человек должен увидеть, что дороги никуда не делись.
 *  · `rise` и `chain` — один подъём: связка выезжает снизу на такте `rise` и
 *    остаётся стоять на такте `chain`. Второе появление читалось бы как
 *    подмена, а не как остановка камеры.
 */
function stageKeyOf(cue: ConversionCue): 'sources' | 'roads' | 'chain' | 'domino' {
  if (cue === 'client' || cue === 'converge') return 'roads';
  if (cue === 'rise' || cue === 'chain') return 'chain';
  return cue;
}

function ConversionStage({ index, cue }: { index: number; cue: ConversionCue }) {
  const reduceMotion = useReducedMotion();
  const key = stageKeyOf(cue);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={calm(reduceMotion, tween(dur.base))}
        className="flex flex-col justify-end gap-3"
      >
        {key === 'sources' && <SourcesScene wave={cueOrdinal(index, 'sources')} />}
        {key === 'roads' && <RoadsScene toClient={cue === 'client'} />}
        {key === 'chain' && <ChainScene />}
        {key === 'domino' && <DominoScene />}
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Такт 1–2. Районы загораются
// ---------------------------------------------------------------------------

/**
 * Сначала горит только домашний район, потом остальные три.
 *
 * ПЕРВАЯ ВОЛНА — ОДНА ПЛИТКА, и это не экономия анимации. «Расширить
 * инструментарий» имеет смысл только относительно того, что уже есть: пока на
 * карте не увидели одинокий Директ, расширять нечего.
 */
function SourcesScene({ wave }: { wave: number }) {
  const lit = wave > 0 ? SOURCES.map((source) => source.id) : [HOME_SOURCE.id];
  return <SourceGrid lit={lit} homeLabel={conversion.home} />;
}

// ---------------------------------------------------------------------------
// Такт 3–5. Дороги сходятся
// ---------------------------------------------------------------------------

/** Порядок дорог задаёт контент, а не порядок районов на карте. */
const ROAD_SOURCES: readonly Source[] = conversion.roads
  .map((id) => SOURCES.find((source) => source.id === id))
  .filter((source): source is Source => Boolean(source));

/**
 * Три дороги, сходящиеся в одной точке.
 *
 * Точка меняется — сама развилка нет: сначала это конкретный клиент (три
 * канала на один проект — нормальная работа), потом одна посадка (а вот это
 * уже потолок). Дороги рисуются один раз и переживают смену цели.
 */
function RoadsScene({ toClient }: { toClient: boolean }) {
  const reduceMotion = useReducedMotion();
  const target = toClient ? conversion.client : conversion.landing;
  const n = ROAD_SOURCES.length;

  return (
    <div className="flex flex-col">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {ROAD_SOURCES.map((source) => (
          <span key={source.id} className="flex flex-col items-center gap-1">
            <span className="legend rounded-plate border border-line px-1.5 py-0.5 text-ink-dim">
              {source.glyph}
            </span>
            <span className="legend text-center text-ink-dim">{source.channel}</span>
          </span>
        ))}
      </div>

      <svg
        viewBox="0 0 300 96"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="h-24 w-full"
      >
        {ROAD_SOURCES.map((source, i) => {
          const x = (300 * (i + 0.5)) / n;
          return (
            <motion.path
              key={source.id}
              // Дорога уходит вниз и подворачивает к общей точке: прямые лучи
              // читались бы как схема, а не как улицы города.
              d={`M ${x} 0 C ${x} 52, 150 46, 150 96`}
              fill="none"
              stroke="var(--color-neon-dim)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={calm(reduceMotion, {
                ...tween(dur.epic),
                delay: i * stagger.reveal,
              })}
            />
          );
        })}
      </svg>

      <MetalPanel className="flex flex-col items-center gap-1 px-4 py-3">
        <span className="font-display text-base font-semibold uppercase tracking-wide text-ink">
          {target.title}
        </span>
        <span className="legend text-ink-dim">{target.caption}</span>
      </MetalPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 6–7. Камера идёт вверх, связка получает имена
// ---------------------------------------------------------------------------

/**
 * Связка на шаге `conversion`: участки названы, ни один не открыт, кроме
 * трафика — он был у человека всегда.
 *
 * СОСТОЯНИЕ УЧАСТКОВ НЕ ЗАДАЁТСЯ ЗДЕСЬ. `ConversionChain` спрашивает его у
 * `zoneState(zone, step)`, и `step` — это `'conversion'`, а не флаг сцены:
 * забыть открыть или случайно открыть участок из экрана невозможно.
 */
function ChainScene() {
  const reduceMotion = useReducedMotion();

  return (
    // Кадр обрезан сверху и снизу: связка въезжает из-за нижней кромки, как
    // будто камера поднимается вдоль неё, а не подставляет готовую картинку.
    <div className="overflow-hidden">
      <motion.div
        initial={reduceMotion ? false : { y: 64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        // Связка не появляется и не исчезает — она ЕДЕТ по кадру вместе с
        // камерой, поэтому кривая с разгоном и торможением, а не ease-out.
        transition={calm(reduceMotion, tween(dur.epic, ease.inOut))}
        // Масштаб — это расстояние камеры: целиком связка в кадр сцены не
        // помещается, а резать её нельзя, вся мысль в том, что она длинная.
        className="origin-top scale-[0.88]"
      >
        <ConversionChain step="conversion" dense className="-mb-12" />
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 8–9. Два специалиста
// ---------------------------------------------------------------------------

/**
 * Big Domino в кадре: одна комната против всей дороги.
 *
 * ФРАЗА ЗДЕСЬ НЕ ПОВТОРЯЕТСЯ. Она звучит в логе реплик рядом, а кадр показывает
 * то, о чём она: слева — то, чем управляет первый, справа — то, на что влияет
 * второй. Дублировать реплику крупным шрифтом значит объяснять картинкой то,
 * что уже сказано словами.
 */
function DominoScene() {
  const reduceMotion = useReducedMotion();
  const { first, second } = conversion.domino;

  return (
    <div className="grid grid-cols-2 gap-2">
      <DominoPanel title={first.title} caption={first.caption}>
        <span className="h-10 w-14 rounded-plate border border-line bg-scene-deep" />
      </DominoPanel>

      <DominoPanel title={second.title} caption={second.caption} lit>
        <span className="flex w-14 flex-col gap-1">
          {CHAIN.map((zone, i) => (
            <motion.span
              key={zone}
              initial={reduceMotion ? false : { opacity: 0, scaleX: 0.4 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={calm(reduceMotion, {
                ...tween(dur.base),
                delay: i * stagger.list,
              })}
              // Верхний сегмент — трафик: единственное, что у человека уже
              // есть. Остальные шесть пока чужие, поэтому не светятся.
              className={cn('h-1.5 origin-left', i === 0 ? 'bg-neon-dim' : 'bg-metal-hi')}
            />
          ))}
        </span>
      </DominoPanel>
    </div>
  );
}

function DominoPanel({
  title,
  caption,
  lit = false,
  children,
}: {
  title: string;
  caption: string;
  lit?: boolean;
  children: ReactNode;
}) {
  return (
    <MetalPanel className="flex flex-col items-center gap-2 p-3">
      <span
        className={cn(
          'font-display text-sm font-semibold uppercase tracking-wide',
          lit ? 'text-neon' : 'text-ink-dim',
        )}
      >
        {title}
      </span>
      <span className="grid h-20 place-items-center" aria-hidden="true">
        {children}
      </span>
      <span className="legend text-center text-ink-dim">{caption}</span>
    </MetalPanel>
  );
}
