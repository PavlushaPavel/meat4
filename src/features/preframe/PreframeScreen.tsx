import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { preframe, preframeBeats, type PreframeCue } from '@/content/preframe';
import { SceneShell } from '@/scene/SceneShell';
import { useBeats } from '@/scene/useBeats';
import { useNav } from '@/router/useNav';
import { AdConsole } from '@/ui/AdConsole';
import { AuthorLine, AuthorNote } from '@/ui/AuthorNote';
import { CitySkyline } from '@/ui/CitySkyline';
import { IncomingMessage } from '@/ui/IncomingMessage';
import { MetalPanel } from '@/ui/MetalPanel';
import { vibrate } from '@/lib/telegram';
import { HOME_SOURCE } from '@/world';
import { cn } from '@/lib/cn';

/**
 * Состояние 1. Вход в Traffic Town.
 *
 * ОДНА СЦЕНА НА ПОЛТОРЫ МИНУТЫ, И НИ ОДНОГО НАЖАТИЯ ВНУТРИ. Прежняя воронка
 * резала эту же мысль на девять экранов с кнопкой «дальше» под каждым; здесь
 * автор говорит, город иллюстрирует сказанное, а главное действие появляется
 * ровно один раз — когда сцена договорила (docs/SPEC.md §2.1).
 *
 * ПОРЯДОК СОБЫТИЙ ДЕРЖИТ ВСЮ ВОРОНКУ. Сначала чужая претензия, потом автор,
 * потом кабинет, и только после этого камера отъезжает. Если отъехать раньше,
 * человек услышит «ты копаешь не там» до того, как узнает свою неделю в
 * перечислении, — и это будет упрёк, а не узнавание.
 */
export function PreframeScreen() {
  const { next } = useNav();
  const run = useBeats(preframeBeats);

  return (
    <SceneShell
      run={run}
      total={preframeBeats.length}
      stage={<PreframeStage index={run.index} cue={run.current.cue} />}
      cta={preframe.cta}
      onCta={next}
    />
  );
}

/**
 * Сколько тактов с этой подсказкой уже прошло, считая текущий.
 *
 * Нужен там, где ОДНА подсказка держит несколько тактов и должна за это время
 * что-то менять: сообщение приходит и открывается, камера отъезжает слоями.
 * Считаем по порядку тактов, а не по их `id`: сценарий правится текстом, и
 * экран не должен ломаться от переименованного такта.
 */
function cueOrdinal(index: number, cue: PreframeCue): number {
  let n = -1;
  for (let i = 0; i <= index; i++) {
    if (preframeBeats[i].cue === cue) n++;
  }
  return Math.max(0, n);
}

function PreframeStage({ index, cue }: { index: number; cue: PreframeCue }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        // Ключ — подсказка, а не номер такта: пока город показывает одно и то
        // же, сцена не должна мигать на каждой реплике. Кабинет листает окна
        // шесть тактов подряд и переживает их без единой перерисовки.
        key={cue}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col justify-end gap-3"
      >
        {cue === 'message' && <MessageScene opened={cueOrdinal(index, 'message') > 0} />}
        {cue === 'author' && <AuthorScene />}
        {cue === 'console' && <ConsoleScene />}
        {cue === 'pullback' && (
          <Pullback layers={preframe.pullback} depth={cueOrdinal(index, 'pullback')} />
        )}
        {cue === 'district' && <DistrictScene />}
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Такт 1–2. Сообщение клиента поверх города
// ---------------------------------------------------------------------------

/** Сколько «печатает…» до текста. Столько же, сколько человек печатает такое. */
const TYPING_MS = 1500;

/** Узор вибрации: короткий толчок, пауза, второй. Так дёргается телефон. */
const BUZZ = [18, 70, 26];

/**
 * Уведомление приходит, потом открывается.
 *
 * ДВА СОСТОЯНИЯ, А НЕ ОДНО, ПОТОМУ ЧТО В УВЕДОМЛЕНИИ ТЕКСТ ОБРЕЗАН. Превью
 * показывает две строки — ровно как настоящий Telegram, и это честно; но
 * первая фраза воронки не имеет права остаться недочитанной, поэтому вторым
 * тактом сообщение открывается целиком.
 */
function MessageScene({ opened }: { opened: boolean }) {
  const reduceMotion = useReducedMotion();
  // При «меньше движения» сцена вообще не проигрывается и до этого экрана не
  // доходит — но если дошла, ждать точек незачем.
  const [delivered, setDelivered] = useState(() => Boolean(reduceMotion));

  useEffect(() => {
    if (delivered) return;
    const timer = window.setTimeout(() => {
      setDelivered(true);
      // Телефон дёргается ровно в момент доставки. Вибрация — усиление
      // события, а не его носитель: вне Telegram на iOS её не будет вовсе.
      vibrate(BUZZ);
    }, TYPING_MS);
    return () => window.clearTimeout(timer);
  }, [delivered]);

  return (
    <div className="flex flex-col justify-end gap-4">
      <CitySkyline className="opacity-40" />
      {opened ? (
        <OpenedMessage />
      ) : (
        <IncomingMessage
          sender={preframe.message.sender}
          typing={preframe.message.typing}
          text={preframe.message.text}
          delivered={delivered}
        />
      )}
    </div>
  );
}

/**
 * Открытое сообщение. Собрано из палитры мессенджера (`--color-tg-*`) и
 * намеренно выпадает из мира: ни неона, ни металла, ни жёлтой ленты. Узнать
 * свою переписку человек должен раньше, чем заметит стилизацию
 * (docs/SPEC.md §3.3).
 */
function OpenedMessage() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-white/10 bg-tg-scene/95 p-3.5 shadow-[0_18px_40px_-16px_#000]"
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-tg-out font-display text-base font-semibold text-tg-ink"
        >
          {preframe.message.sender.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-tg-ink">
            {preframe.message.sender}
          </p>
          <p className="legend text-tg-dim">{preframe.message.app}</p>
        </div>
      </div>
      <p className="mt-3 max-w-[85%] rounded-2xl rounded-tl-sm bg-tg-in px-3.5 py-2.5 text-small leading-relaxed text-tg-ink">
        {preframe.message.text}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Такт 3–4. Автор появляется персонажем
// ---------------------------------------------------------------------------

/**
 * Автор входит в кадр.
 *
 * ФОТОГРАФИИ У НЕГО НЕТ, и придумывать её нельзя. Поэтому персонаж — это
 * силуэт на фоне города и та самая врезка `AuthorNote`, которой автор говорит
 * во всей воронке: узнаётся форма голоса, а не лицо.
 */
function AuthorScene() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-28">
        <CitySkyline className="absolute inset-x-0 bottom-0 h-20 opacity-40" />
        <motion.div
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center"
        >
          {/* Кромка сверху — свет вывески района за спиной. */}
          <span className="size-6 rounded-full bg-scene-deep ring-1 ring-neon-dim/60" />
          <span className="-mt-1 h-16 w-16 rounded-t-[45%] bg-scene-deep ring-1 ring-neon-dim/35" />
        </motion.div>
      </div>

      <AuthorNote>
        <AuthorLine>{preframe.authorNote}</AuthorLine>
      </AuthorNote>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 5–9. Кабинет листает сам себя
// ---------------------------------------------------------------------------

function ConsoleScene() {
  return (
    <div className="flex flex-col gap-2">
      {/* Та же подпись, что у первого слоя отъезда: через два такта камера
          начнёт отъезжать именно отсюда, и место должно называться одинаково. */}
      <p className="legend text-ink-dim">{preframe.pullback[0]}</p>
      <AdConsole windows={preframe.console} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 10–13. Камера отъезжает
// ---------------------------------------------------------------------------

/**
 * Масштаб группы на каждом слое отъезда. Считать его из размеров рамок нельзя:
 * значения подобраны так, чтобы текущий слой заполнял кадр целиком, а не
 * болтался в его середине.
 */
const SCALES = [2.3, 1.6, 1.2, 1];

/**
 * Отъезд камеры: рабочее место → квартира → дом → улица.
 *
 * Рамки вложены физически, одна в другую, и отъезд — это ОДНО изменение
 * масштаба группы. Отдельными картинками слоёв это выглядело бы как смена
 * слайдов: человек должен видеть, что комната никуда не делась, просто вокруг
 * неё оказалось всё остальное.
 */
function Pullback({ layers, depth }: { layers: readonly string[]; depth: number }) {
  const reduceMotion = useReducedMotion();
  const scale = SCALES[Math.min(depth, SCALES.length - 1)] ?? 1;

  const nested = layers.reduce<ReactNode>(
    (inner, label, i) => (
      <Frame key={label} label={label} shown={depth >= i} outer={i === layers.length - 1}>
        {inner}
      </Frame>
    ),
    <Desk />,
  );

  return (
    <div className="relative h-56 overflow-hidden rounded-panel border border-line bg-scene-deep/50">
      <motion.div
        className="absolute inset-0 grid place-items-center"
        initial={false}
        animate={{ scale }}
        transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        {nested}
      </motion.div>
    </div>
  );
}

/**
 * Одна рамка отъезда. Прозрачностью КОНТЕЙНЕРА не управляем: она наследуется
 * вложенными слоями, и спрятанная улица утащила бы за собой и рабочее место.
 * Поэтому невидимый слой — это прозрачная кромка, а не прозрачный блок.
 */
function Frame({
  label,
  shown,
  outer,
  children,
}: {
  label: string;
  shown: boolean;
  outer: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative grid place-items-center rounded-plate border p-5 transition-colors duration-700',
        shown ? 'border-line' : 'border-transparent',
        outer && 'size-52',
      )}
    >
      <span
        className={cn(
          'legend absolute left-2 top-1 transition-opacity duration-700',
          shown ? 'text-ink-dim opacity-100' : 'opacity-0',
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Ядро кадра: монитор рекламного кабинета. Единственное, что светится. */
function Desk() {
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-16 place-items-center rounded-plate border border-neon-dim/70 bg-scene-deep"
    >
      <span className="h-0.5 w-8 bg-neon-dim" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Такт 14–15. Вывеска района
// ---------------------------------------------------------------------------

/**
 * Вывеска над горизонтом.
 *
 * ИМЯ БЕРЁТСЯ ИЗ `HOME_SOURCE`, а не из контента: район — это карта мира, и
 * второй экземпляр его названия однажды разъедется с первым. Светится он
 * законно: рекламный кабинет был у человека всегда, и `zoneState('traffic')`
 * на этом шаге уже `open`.
 */
function DistrictScene() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        // Неон включается не плавно, а с перебоем: так зажигается вывеска.
        animate={reduceMotion ? { opacity: 1 } : { opacity: [0, 1, 0.3, 1] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.9, times: [0, 0.4, 0.6, 1] }
        }
      >
        <MetalPanel className="px-4 py-2.5">
          <span className="neon-ink font-display text-lg font-semibold uppercase tracking-wide">
            {HOME_SOURCE.name}
          </span>
        </MetalPanel>
      </motion.div>

      <p className="legend text-ink-dim">{preframe.district}</p>
      <CitySkyline className="opacity-70" />
    </div>
  );
}
