import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { playerUi } from '@/content/scene';
import { calm, dur, tween } from '@/scene/motion';
import { haptics } from '@/lib/telegram';
import { cn } from '@/lib/cn';

/**
 * Карточка голосового поверх афиши.
 *
 * ЧЕМ ОНА ОТЛИЧАЕТСЯ ОТ ПРЕЖНЕГО ПУЗЫРЯ МЕССЕНДЖЕРА. Пузырь был
 * СОБЫТИЕМ входа: сообщение пришло, человек его открыл, экран сменился. Эта
 * карточка — ПРИБОР, который живёт на сцене весь рассказ: человек в любой
 * момент видит, сколько осталось, и может остановить голос, не выходя из
 * города. Отсюда все различия формы: нет портрета отправителя (он и так стоит
 * в кадре во весь рост), нет переключателя скорости (в приборе рассказа он
 * лишний орган), зато есть постоянная подпись и хронометраж.
 *
 * ПОЧЕМУ У НЕЁ КРУГЛЫЕ УГЛА, КОГДА ГОРОД СВАРЕН ИЗ МЕТАЛЛА (радиусы мира —
 * 2–4px, `tokens.css`). Это та же уступка, что когда-то вывела переписку с
 * клиентом из декораций: карточка притворяется поверхностью Telegram, а не
 * панелью промзоны, и узнаваемость этой формы работает сильнее стилизации под
 * мир. Радиус здесь — часть цитаты, а не украшение; во всём остальном мире он
 * по-прежнему запрещён.
 *
 * КАРТОЧКА НЕ ПРИТВОРЯЕТСЯ ИГРАЮЩЕЙ. Пока записи нет, полоса не бежит по
 * тишине, бегунка нет вовсе и перемотка выключена: движение там, где ничего не
 * звучит, — та же ложь, что выдуманный таймкод на несуществующем видео. Кнопка
 * при этом остаётся живой и честно ведёт дальше — вступление идёт текстом.
 *
 * ПОЗИЦИОНИРОВАНИЕ СНАРУЖИ. Карточка не знает, где на афише она лежит, и не
 * выбирает себе место: раскладку задаёт сцена через `className`. Иначе у одной
 * координаты оказалось бы два хозяина.
 */

/** Сколько столбиков в дорожке. Нечётное — у волны есть центр. */
const BARS = 55;

/**
 * Высоты столбиков.
 *
 * Считаются один раз из индекса, а не случайно: случайная волна
 * перерисовывалась бы на каждый кадр воспроизведения и «кипела» бы под пальцем.
 * Форма дорожки — отпечаток конкретной записи, она обязана быть постоянной.
 *
 * Разброс уже, чем у пузыря мессенджера (0.32…1 против 0.28…1 с подъёмом к
 * центру): на референсе дорожка ровная, как у диктофона, а не как у речевого
 * сообщения. Общий силуэт при этом остаётся неровным — идеально ровный
 * частокол читался бы как индикатор загрузки.
 */
const WAVE = Array.from({ length: BARS }, (_, i) => {
  const grain = Math.sin(i * 12.9898) * 43758.5453;
  const jitter = grain - Math.floor(grain);
  const swell = Math.sin((i / (BARS - 1)) * Math.PI * 3.5);
  return 0.32 + jitter * 0.5 + Math.abs(swell) * 0.18;
});

/** Шаг перемотки с клавиатуры: доля записи, а не секунды — длина заранее не известна. */
const KEY_STEP = 0.05;

export function VoicePlayer({
  available,
  playing,
  position,
  duration,
  onToggle,
  onSeek,
  rate,
  onRate,
  className,
}: {
  /** Запись подключена. Ложь — прибор показывает объявленный хронометраж и не бежит. */
  available: boolean;
  playing: boolean;
  /** Секунды. */
  position: number;
  /** Секунды; без записи сюда приходит объявленная длина рассказа. */
  duration: number;
  /** Играть/пауза; без записи — «начать без записи». */
  onToggle: () => void;
  /** Перемотка, 0…1. Без записи не вызывается никогда. */
  onSeek?: (ratio: number) => void;
  /** Текущая скорость и переключатель по кругу: 1 → 1,5 → 2. */
  rate?: number;
  onRate?: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  // Пройденная доля. Без записи — жёсткий ноль, а не «сколько получится»:
  // единственное место, где решается, бежит полоса или стоит.
  const ratio =
    available && duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const seek = available ? onSeek : undefined;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={calm(reduceMotion, tween(dur.base))}
      className={cn(
        // Плотность заливки — решение о ЧИТАЕМОСТИ, а не о красоте стекла.
        // Карточка ложится на фотографию, и под ней может оказаться освещённый
        // фасад: на 72% мелкая подпись `ink-dim` проваливалась до 3:1 над
        // светлым пятном. 85% оставляют город узнаваемым сквозь стекло и
        // держат контраст ≥4.5:1 на любом кадре — проверять его на глаз по
        // одному кадру нельзя, фон здесь не наш.
        'w-full rounded-2xl border border-line bg-scene-deep/85 px-4 pt-2.5 pb-2',
        // Стекло: карточка лежит на фотографии города, и без размытия мелкая
        // подпись тонет в окнах небоскрёбов. Тень отделяет её от кадра — на
        // афише нет полей, отделять больше нечем, — а блик по верхней кромке
        // даёт стеклу толщину: без него панель читается как дырка в кадре.
        'shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_10%,transparent),0_18px_44px_-22px_#000] backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="legend flex items-center gap-1.5 pt-0.5 text-ink-dim">
          {/* Микро-треугольник перед подписью: он с референса и говорит, что
              подпись относится к звуку, а не к сцене. Рисуется рамкой — одна
              фигура без иконочного шрифта и без внешнего файла. */}
          <span
            aria-hidden="true"
            className="size-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-current"
          />
          {playerUi.label}
        </p>

        <HexWave active={available && playing} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            // Тактильный отклик живёт в компоненте, а не на экранах
            // (то же правило, что в `Button.tsx`). Это главный жест карточки —
            // средний импульс, как у главного действия экрана.
            haptics.medium();
            onToggle();
          }}
          aria-label={available ? (playing ? playerUi.pause : playerUi.play) : playerUi.pendingAction}
          className={cn(
            // 48px — палец с запасом (минимум 44px), но не больше: круг и так
            // единственное светящееся пятно карточки и перетягивает всё на себя.
            'grid size-12 shrink-0 place-items-center rounded-full bg-hazard text-on-hazard',
            // Свечение фонаря: жёлтый круг — единственный источник света в
            // карточке, и на ночном кадре он обязан светиться, иначе читается
            // как наклейка.
            'shadow-[0_0_30px_-6px_var(--color-hazard)]',
            'transition-transform duration-[var(--dur-press)] ease-[var(--ease-snap)] active:scale-95',
          )}
        >
          <Glyph paused={!available || !playing} />
        </button>

        <Track ratio={ratio} live={available} onSeek={seek} />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        {/*
          БЕЗ ЗАПИСИ ВМЕСТО ПРОЙДЕННОГО ВРЕМЕНИ СТОИТ ПРИЧИНА. Показать «0:00»
          было бы формально правдой и практически ложью: ноль читается как
          «сейчас начнётся с начала», а начинать нечего. Объявленный хронометраж
          справа остаётся — он настоящий, его знает сценарий.
        */}
        {available ? (
          <>
            {/*
              СКОРОСТЬ — ТАМ ЖЕ, ГДЕ В МЕССЕНДЖЕРЕ, и по той же причине: почти
              три минуты голоса на входе слушают по-разному. Кто уже понял мысль,
              ускоряется вместо того, чтобы бросить; кто слушает на ходу —
              оставляет как есть. Переключение по кругу, а не список: выбор из
              трёх значений не заслуживает отдельного меню.
            */}
            {onRate && rate ? (
              <button
                type="button"
                onClick={onRate}
                aria-label={playerUi.rateAria}
                className="legend min-h-9 rounded-plate border border-line px-2.5 text-ink-dim transition-colors duration-150 active:bg-ink/10"
              >
                {formatRate(rate)}
              </button>
            ) : (
              <span />
            )}
            <span className="font-display text-small tabular-nums text-ink-dim">
              <span className="text-hazard">{clock(position)}</span> / {clock(duration)}
            </span>
          </>
        ) : (
          <>
            <span className="legend text-ink-dim">{playerUi.pending}</span>
            <span className="font-display text-small tabular-nums text-ink-dim">
              {clock(duration)}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** Время в записи: М:СС. Пока метаданных нет, показывать нечего. */
/** Скорость в подписи кнопки: 1× / 1,5× / 2×. Запятая, а не точка — по-русски. */
function formatRate(rate: number): string {
  return `${String(rate).replace('.', ',')}×`;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Треугольник и пауза. Рисуются вектором: в мире нет иконочного шрифта. */
function Glyph({ paused }: { paused: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
      {paused ? (
        // Треугольник смещён вправо на пол-пикселя оптического центра: в круге
        // геометрический центр треугольника всегда кажется сдвинутым влево.
        <path d="M9 5.5 19 12 9 18.5Z" />
      ) : (
        <>
          <rect x="8" y="5.5" width="3.2" height="13" rx="1" />
          <rect x="12.8" y="5.5" width="3.2" height="13" rx="1" />
        </>
      )}
    </svg>
  );
}

/**
 * Знак звука в шестиугольнике — правый верхний угол карточки.
 *
 * Это не кнопка и не индикатор громкости: это марка прибора, такая же, как
 * трафаретный номер на панели. Единственное, что он сообщает, — звук сейчас
 * идёт или нет, и сообщает это яркостью, а не движением: мигающий значок в
 * углу перетягивал бы взгляд с реплики, ради которой всё и затевалось.
 */
function HexWave({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 26"
      aria-hidden="true"
      className={cn(
        'size-6 shrink-0 transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)]',
        active ? 'text-hazard' : 'text-hazard/55',
      )}
    >
      <path
        d="M12 1 22 6.75v12.5L12 25 2 19.25V6.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Пять штрихов волны: центральный длинный, к краям короче. */}
      {[
        [7.5, 4],
        [9.75, 7],
        [12, 10],
        [14.25, 7],
        [16.5, 4],
      ].map(([x, h]) => (
        <rect
          key={x}
          x={(x as number) - 0.6}
          y={13 - (h as number) / 2}
          width="1.2"
          height={h}
          rx="0.6"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

/**
 * Дорожка записи. Она же перемотка.
 *
 * ДВА СЛОЯ, И ЭТО НЕ ИЗБЫТОЧНОСТЬ. Столбики — отпечаток записи: по ним видно,
 * где в рассказе плотная речь, а где пауза. Тонкая линия под ними — шкала: по
 * столбикам невозможно точно прицелиться пальцем, у них нет непрерывности.
 * Пройденное окрашено на обоих слоях одним жёлтым, поэтому глаз читает их как
 * один предмет с линией берега, а не как два прибора.
 *
 * ЦЕЛЬ ДЛЯ ПАЛЬЦА — ВСЯ ПОЛОСА ЦЕЛИКОМ (44px по высоте вместе с отступами), а
 * не бегунок: отдельный тонкий ползунок на телефоне не берётся.
 */
function Track({
  ratio,
  live,
  onSeek,
}: {
  ratio: number;
  live: boolean;
  onSeek?: (ratio: number) => void;
}) {
  function seekAt(event: ReactPointerEvent<HTMLDivElement>) {
    if (!onSeek) return;
    const box = event.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  }

  // Перемотка с клавиатуры. Полоса объявлена ползунком, и ползунок, который не
  // слушает стрелки, — обещание без исполнения.
  function seekByKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!onSeek) return;
    const step =
      event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP : 0;
    if (step === 0) return;
    event.preventDefault();
    onSeek(Math.min(1, Math.max(0, ratio + step)));
  }

  const percent = `${ratio * 100}%`;

  return (
    <div
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? playerUi.seekAria : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(ratio * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={seekAt}
      onKeyDown={seekByKey}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2 py-2.5 outline-none',
        onSeek && 'cursor-pointer focus-visible:ring-1 focus-visible:ring-hazard',
      )}
    >
      <div aria-hidden="true" className="flex h-5 items-center gap-[2px]">
        {WAVE.map((height, i) => (
          <span
            key={i}
            style={{ height: `${Math.round(height * 100)}%` }}
            className={cn(
              'w-full rounded-[1px] transition-colors duration-[var(--dur-quick)] ease-[var(--ease-snap)]',
              // Строгое «меньше»: при нулевой доле не должен гореть даже первый
              // столбик, иначе прибор показывает начатое воспроизведение там,
              // где ничего не начиналось.
              live && i / BARS < ratio ? 'bg-hazard' : 'bg-ink-dim/45',
            )}
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        className={cn(
          'relative h-[2px] w-full rounded-full',
          // Без записи шкала гасится вся. Тёмно-жёлтая полоса — это «дорога,
          // по которой уже можно ехать»; на молчащей карточке она обещала бы
          // воспроизведение так же уверенно, как бегущий бегунок.
          live ? 'bg-hazard-deep/55' : 'bg-ink-dim/25',
        )}
      >
        <span
          style={{ width: percent }}
          className="absolute inset-y-0 left-0 rounded-full bg-hazard transition-[width] duration-[var(--dur-quick)] ease-[var(--ease-snap)]"
        />
        {/*
          Бегунок появляется только вместе с записью. Точка на нуле молчащей
          дорожки — это обещание, что сейчас поедет, и его никто не исполнит.
        */}
        {live && (
          <span
            style={{ left: percent }}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hazard shadow-[0_0_12px_-2px_var(--color-hazard)] transition-[left] duration-[var(--dur-quick)] ease-[var(--ease-snap)]"
          />
        )}
      </div>
    </div>
  );
}
