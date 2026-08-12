import { motion, useReducedMotion } from 'motion/react';
import { prevStep, type StepKey } from '@/router/flow';
import { CHAIN, DISTRICT_NAME, ZONES, zoneState, type ZoneId, type ZoneState } from '@/world';
import { dur, ease, spring, tween } from '@/scene/motion';
import { Legend } from '@/ui/Plate';
import { cn } from '@/lib/cn';

/**
 * Связка: от трафика до денег клиента. Главный компонент воронки.
 *
 * ПРАВИЛА, КОТОРЫЕ НЕЛЬЗЯ НАРУШАТЬ (docs/SPEC.md §1.3):
 *
 * 1. Компонент НИЧЕГО НЕ РЕШАЕТ САМ. Состояние участка спрашивается у
 *    `zoneState(zone, step)`. Флага «открыто» здесь нет и быть не может —
 *    иначе можно забыть открыть участок, и воронка молча соврёт.
 * 2. Четыре состояния читаются с одного взгляда: туман, контур, имя серым,
 *    неон. Пятого визуального состояния нет.
 * 3. Поток между участками горит, ТОЛЬКО если открыты оба соседних. Горящая
 *    линия в закрытый участок — обещание, которого продукт не выполняет.
 * 4. ЛИД, КВАЛ и ПРОДАЖА не загораются никогда. Они внутри рамки района
 *    конверсий, потому что это часть пути денег, но серые, потому что не твои.
 * 5. ТРАФИК стоит ВЫШЕ рамки. Рекламный кабинет — не участок конверсии, и
 *    вся мысль воронки в том, что человек всю жизнь работал над одной
 *    строчкой, стоящей до неё.
 */
export function ConversionChain({
  step,
  className,
  /** Компактный вид: без подписей под именами. Для сцены, где мало места. */
  dense = false,
}: {
  step: StepKey;
  className?: string;
  dense?: boolean;
}) {
  const [traffic, ...inside] = CHAIN;

  return (
    <div className={cn('flex flex-col', className)}>
      <ZoneRow id={traffic} step={step} dense={dense} />
      <Flow lit={isLit(traffic, inside[0], step)} />

      <div className="relative rounded-panel border border-line px-3 pb-3 pt-5">
        <Legend
          tone="dim"
          className="absolute -top-2 left-3 bg-scene px-2"
        >
          {DISTRICT_NAME}
        </Legend>

        {inside.map((id, i) => (
          <div key={id}>
            <ZoneRow id={id} step={step} dense={dense} />
            {i < inside.length - 1 && <Flow lit={isLit(id, inside[i + 1], step)} />}
          </div>
        ))}
      </div>

      <Flow lit={false} />
      <Legend tone="dim" className="self-center">
        ₽ ДЕНЬГИ КЛИЕНТА
      </Legend>
    </div>
  );
}

/** Горит ли поток между двумя соседними участками. Оба должны быть открыты. */
function isLit(from: ZoneId, to: ZoneId, step: StepKey): boolean {
  return zoneState(from, step) === 'open' && zoneState(to, step) === 'open';
}

/**
 * Открылся ли участок ИМЕННО НА ЭТОМ ШАГЕ — то есть надо ли его зажигать.
 *
 * ЗАЧЕМ ЭТО НУЖНО. Зажигание — событие, а не состояние: оно случается за всю
 * воронку максимум четыре раза. Но карта показывается на четырёх экранах
 * подряд, и без этой проверки неон бил бы заново на каждом из них — событие
 * превратилось бы в тик, а тик не читается как награда.
 *
 * ЗАЧЕМ ИМЕННО ТАК, А НЕ ФЛАГОМ. Флага «только что открылось» здесь быть не
 * может ровно по той же причине, по какой нет флага «открыто» (docs/SPEC.md
 * §1.3): его можно забыть поднять, и воронка молча соврёт. Поэтому вопрос
 * задаётся тому же расписанию, только в двух его точках — на этом шаге и на
 * предыдущем. Состояние по-прежнему считается функцией шага, а событие — это
 * разница между двумя её значениями.
 *
 * На первом шаге маршрута предыдущего нет, и это не дыра: ТРАФИК был у
 * человека всегда, он ничего не забирал — зажигать нечего.
 */
function justOpened(id: ZoneId, step: StepKey): boolean {
  if (zoneState(id, step) !== 'open') return false;
  const before = prevStep(step);
  return before !== null && zoneState(id, before) !== 'open';
}

/**
 * Перебой неоновой трубки. Словарь взят у вывески района (`PreframeScreen`,
 * `DistrictScene`) слово в слово: удар, провал, ровный свет. Единственный приём
 * зажигания на весь мир — в городе и в связке одно и то же явление, и говорить
 * о нём двумя разными движениями значило бы, что это два разных мира.
 *
 * Вынесено в константы модуля, а не собирается в разметке: одинаковая ссылка
 * на кадры не даёт motion переиграть анимацию при обычной перерисовке строки.
 */
const IGNITE = { opacity: [0, 1, 0.3, 1] };
const IGNITE_TIMES = [0, 0.4, 0.6, 1];

function ZoneRow({
  id,
  step,
  dense,
}: {
  id: ZoneId;
  step: StepKey;
  dense: boolean;
}) {
  const zone = ZONES[id];
  const state = zoneState(id, step);
  const reduceMotion = useReducedMotion();

  // Туман — это отсутствие информации, а не пустая строка с многоточием.
  // Экранному диктору здесь нечего сказать, поэтому строка от него скрыта.
  if (state === 'fog') {
    return <div aria-hidden="true" className="h-11 rounded-plate bg-scene-deep/70" />;
  }

  const skin: Record<Exclude<ZoneState, 'fog'>, string> = {
    shape: 'border border-dashed border-line text-ink-dim',
    known: 'border border-line text-ink-dim',
    open: 'neon-edge text-neon',
  };

  /**
   * Зажигать или просто гореть.
   *
   * При `prefers-reduced-motion` участок горит ровно с первого кадра: перебоя
   * нет, но и порядок событий не съезжает — участок всё равно загорается
   * только на своём шаге, а до него стоит серым (docs/SPEC.md §2.1).
   */
  const ignite = !reduceMotion && justOpened(id, step);

  return (
    <motion.div
      layout={!reduceMotion}
      /*
        Зажигается ВЕСЬ участок — неоновая рамка и имя, а не одна галочка.
        Загорается физический объект: трубка бьёт с перебоем и только потом
        встаёт ровно. Это переход в состояние `open`, а не пятое состояние
        карты: через 0.9 с на экране ровно тот же неон, что и всегда.

        `dur.epic` здесь не «подлиннее», а по списку: включение связки — один
        из четырёх дорогих эпизодов продукта (DESIGN.md §7).
      */
      animate={ignite ? IGNITE : undefined}
      transition={
        ignite ? { ...tween(dur.epic, ease.out), times: IGNITE_TIMES } : undefined
      }
      className={cn(
        'flex min-h-11 items-center justify-between gap-3 rounded-plate px-3 py-2',
        skin[state],
      )}
    >
      <div className="flex flex-col">
        <span className="font-display text-sm font-semibold uppercase tracking-wide">
          {state === 'shape' ? '— — —' : zone.name}
        </span>
        {!dense && state !== 'shape' && (
          <span className="text-legend text-ink-dim">{zone.caption}</span>
        )}
      </div>
      {state === 'open' && (
        <motion.span
          aria-label="участок собран"
          // Галочка выскакивает только вместе с зажиганием — это одно событие
          // в двух слоях. На следующих экранах она просто стоит: пружина на
          // каждом входе в карту была бы тем же тиком, что и повторный неон.
          initial={ignite ? { scale: 0.4, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.mark}
          className="shrink-0 text-neon"
        >
          ✓
        </motion.span>
      )}
    </motion.div>
  );
}

/** Отрезок потока между участками. */
function Flow({ lit }: { lit: boolean }) {
  return (
    <div className="flex h-4 justify-center" aria-hidden="true">
      <div
        className={cn(
          'w-px transition-colors duration-500',
          lit ? 'bg-neon' : 'bg-line',
        )}
      />
    </div>
  );
}
