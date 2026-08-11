import { motion, useReducedMotion } from 'motion/react';
import type { StepKey } from '@/router/flow';
import { CHAIN, ZONES, zoneState, type ZoneId, type ZoneState } from '@/world';
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
 * 4. ЛИД, КВАЛ и ПРОДАЖА не загораются никогда. Они внутри рамки Conversion
 *    District, потому что это часть пути денег, но серые, потому что не твои.
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
          CONVERSION DISTRICT
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

  return (
    <motion.div
      layout={!reduceMotion}
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
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 22 }}
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
