import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { calm, dur, tween } from '@/scene/motion';
import { MetalPanel } from '@/ui/MetalPanel';
import { Legend } from '@/ui/Plate';
import { cn } from '@/lib/cn';

/**
 * Рабочее место директолога: окна рекламного кабинета, которые сменяют друг
 * друга сами.
 *
 * ПОЧЕМУ ЭТО НЕ КАРТИНКА. Скриншот Директа — чужой интерфейс с чужими цифрами:
 * он датируется, он врёт про наш продукт («вот же реальные цифры») и его нельзя
 * перекрасить под акт. Здесь всё нарисовано CSS и SVG: списки, столбики, строки
 * запросов, таблица целей. Узнаётся ФОРМА отчёта, а не конкретный кабинет.
 *
 * ЦИФР ВНУТРИ НЕТ. Столбики графика держат форму среза, но не подписаны
 * числами, а строки — это разделы и названия, а не показатели. Как только на
 * панели появится «CPL 1 340 ₽», сцена начнёт читаться как реальная статистика
 * клиента, которой у нас нет.
 *
 * ПАНЕЛЬ СПРЯТАНА ОТ ЭКРАННОГО ДИКТОРА. Она иллюстрирует то, что автор говорит
 * вслух, и весь смысл лежит в логе реплик рядом. Диктовать поверх речи ещё и
 * тридцать строк машинного интерфейса — значит сделать сцену непроходимой на
 * слух.
 *
 * `prefers-reduced-motion`: окна не листаются вообще, человек видит первое и
 * статичное. Тот, кто просил не двигать экран, просил и не ждать следующего
 * кадра, чтобы понять, о чём речь.
 */

/** Как нарисовано содержимое окна. Пятый вид вводить только под новый экран. */
export type AdWindowKind =
  /** Список кампаний: статус, имя, полоса объёма. */
  | 'list'
  /** Строки, с которыми что-то сделали: запросы в минус, площадки в отключку. */
  | 'lines'
  /** Столбики среза по дням. */
  | 'chart'
  /** Таблица настроек: цели, корректировки. */
  | 'table';

export interface AdWindow {
  /** Ключ окна. Нужен анимации переключения, в интерфейсе не виден. */
  id: string;
  /** Строка пути в шапке: КАБИНЕТ / КАМПАНИИ. */
  crumb: string;
  /** Заголовок раздела. */
  title: string;
  kind: AdWindowKind;
  /** Строки раздела. Машинный интерфейс, приходит из контента. */
  rows: readonly string[];
  /** Подпись действия справа от строки: МИНУС, ОТКЛ. Только для `lines`. */
  mark?: string;
}

/**
 * Форма отчёта: доли высоты столбиков и длины полос. Набор фиксирован и
 * подобран руками — случайные значения на каждой перерисовке превращали панель
 * в мигающий шум, а ровные ступеньки читались как выдуманный рост.
 */
const SHAPE = [58, 82, 41, 96, 67, 34, 74];

/** Какие строки таблицы включены. Тоже форма, а не данные проекта. */
const TABLE_ON = [true, true, false, true, false];

export function AdConsole({
  windows,
  className,
  /** Сколько держится одно окно. Меньше двух секунд — рябь, больше пяти — сон. */
  periodMs = 3200,
}: {
  windows: readonly AdWindow[];
  className?: string;
  periodMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || windows.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % windows.length),
      periodMs,
    );
    return () => window.clearInterval(timer);
  }, [periodMs, reduceMotion, windows.length]);

  // Список окон приходит из контента и может оказаться пустым при правке
  // сценария. Пустая металлическая рамка честнее падения всей сцены.
  const win = windows[Math.min(index, windows.length - 1)];
  if (!win) return null;

  return (
    // `aria-hidden` висит на обёртке, а не на панели: `MetalPanel` принимает
    // только свои пропсы и чужие атрибуты в разметку не пропускает.
    <div aria-hidden="true" className={className}>
      <MetalPanel className="overflow-hidden p-3">
        <header className="flex items-center justify-between gap-3 border-b border-line pb-2">
          <Legend tone="dim" className="truncate">
            {win.crumb}
          </Legend>
          <span className="flex shrink-0 items-center gap-1">
            {windows.map((w, i) => (
              <span
                key={w.id}
                className={cn(
                  'h-1 w-3 transition-colors duration-300',
                  i === index ? 'bg-neon-dim' : 'bg-metal-hi',
                )}
              />
            ))}
          </span>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={win.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={calm(reduceMotion, tween(dur.quick))}
            className="pt-2.5"
          >
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
              {win.title}
            </p>
            {/*
              Высота тела фиксирована: разделы разной длины иначе дёргали бы всю
              сцену вверх-вниз на каждом переключении, и отъезд камеры дальше
              читался бы как продолжение этой тряски.
            */}
            <div className="mt-2 h-40">
              <WindowBody win={win} />
            </div>
          </motion.div>
        </AnimatePresence>
      </MetalPanel>
    </div>
  );
}

function WindowBody({ win }: { win: AdWindow }) {
  if (win.kind === 'chart') return <ChartBody rows={win.rows} />;
  if (win.kind === 'lines') return <LinesBody rows={win.rows} mark={win.mark} />;
  if (win.kind === 'table') return <TableBody rows={win.rows} />;
  return <ListBody rows={win.rows} />;
}

/** Кампании: лампа состояния, имя, полоса объёма. */
function ListBody({ rows }: { rows: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <li key={row} className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              i % 3 === 2 ? 'bg-metal-hi' : 'bg-neon-dim',
            )}
          />
          <span className="legend min-w-0 flex-1 truncate text-ink-dim">{row}</span>
          <span className="h-1.5 w-14 shrink-0 bg-metal-lo">
            <span
              className="block h-full bg-metal-hi"
              style={{ width: `${SHAPE[i % SHAPE.length]}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Запросы и площадки: то, с чем человек уже что-то сделал руками. */
function LinesBody({ rows, mark }: { rows: readonly string[]; mark?: string }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row}
          className="flex items-center justify-between gap-3 border-b border-line/70 py-1.5 last:border-b-0"
        >
          <span className="legend min-w-0 flex-1 truncate text-ink-dim">{row}</span>
          {mark && <span className="legend shrink-0 text-hazard">{mark}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Срез по дням. Столбики без чисел: форма отчёта, а не показатели проекта. */
function ChartBody({ rows }: { rows: readonly string[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-1.5">
        {rows.map((row, i) => (
          <span
            key={row}
            className="flex-1 bg-metal-hi"
            style={{ height: `${SHAPE[i % SHAPE.length]}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1">
        {rows.map((row) => (
          <span key={row} className="legend flex-1 text-center text-ink-dim">
            {row}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Цели и корректировки: имя настройки и её состояние. */
function TableBody({ rows }: { rows: readonly string[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row, i) => {
        const on = TABLE_ON[i % TABLE_ON.length];
        return (
          <li
            key={row}
            className="flex items-center justify-between gap-3 border-b border-line/70 py-1.5 last:border-b-0"
          >
            <span className="legend min-w-0 flex-1 truncate text-ink-dim">{row}</span>
            <span className={cn('legend shrink-0', on ? 'text-neon-dim' : 'text-ink-dim')}>
              {on ? '✓' : '—'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
