import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { preframe, preframeBeats, type PreframeCue } from '@/content/preframe';
import { SceneShell } from '@/scene/SceneShell';
import { calm, dur, ease, tween } from '@/scene/motion';
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
        transition={calm(reduceMotion, tween(dur.base))}
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
      transition={calm(reduceMotion, tween(dur.base))}
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
          transition={calm(reduceMotion, tween(dur.screen))}
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
 * Куда встаёт камера на каждом такте отъезда. Считать это из размеров рамок
 * нельзя: значения подобраны так, чтобы текущий слой заполнял кадр целиком, а
 * не болтался в его середине.
 *
 * Цель ОДНА НА ВСЕ СЛОИ: в покое отъезд обязан выглядеть ровно тем же
 * вложением рамок, что и раньше. Расходятся слои не здесь, а во времени.
 */
const SCALES = [2.3, 1.6, 1.2, 1];

/**
 * ЧЕМ ДАЛЬШЕ ПЛАН, ТЕМ ОН МЕДЛЕННЕЕ.
 *
 * Это единственное, что отличает отъезд камеры от зума. Пока все четыре рамки
 * ехали одним масштабом, кадр просто менял увеличение — глубины в нём не было,
 * потому что взаимного движения планов не было тоже. Настоящий отъезд виден
 * именно по расхождению: ближний план уходит из кадра заметно раньше дальнего,
 * и разницу человек читает как расстояние между ними.
 *
 * Разводим слои ПО СКОРОСТИ, а не по величине. Если бы у слоёв были разные
 * цели масштаба, рамки в покое перестали бы быть вложением и разъехались бы
 * картинками; здесь же цель общая, и к концу движения геометрия та же.
 *
 * Лестница натянута между `dur.screen` и `dur.epic` — крайние значения берутся
 * из словаря, а доля глубины числом времени не является. Ближнее рабочее место
 * укладывается в 0.42 c, улица приезжает за 0.9 c: чтобы расхождение читалось,
 * разница должна быть кратной, а не косметической.
 */
function layerDuration(index: number, count: number): number {
  const share = index / Math.max(1, count - 1);
  return dur.screen + (dur.epic - dur.screen) * share;
}

/**
 * Отъезд камеры: рабочее место → квартира → дом → улица.
 *
 * Рамки вложены физически, одна в другую: человек должен видеть, что комната
 * никуда не делась, просто вокруг неё оказалось всё остальное. Отдельными
 * картинками слоёв это выглядело бы как смена слайдов.
 *
 * Сама группа НЕ МАСШТАБИРУЕТСЯ: масштаб отдан слоям поимённо, иначе они не
 * могли бы разъехаться по скорости. Здесь остаётся только кадр — окно, за
 * границы которого уезжает всё лишнее.
 */
function Pullback({ layers, depth }: { layers: readonly string[]; depth: number }) {
  const target = SCALES[Math.min(depth, SCALES.length - 1)] ?? 1;
  // Неподвижная опора для самого дальнего слоя: у него нет рамки-родителя, а
  // делить своё положение на родительское должны все одинаково.
  const ground = useMotionValue(1);

  return (
    <div className="relative h-56 overflow-hidden rounded-panel border border-line bg-scene-deep/50">
      <div className="absolute inset-0 grid place-items-center">
        {/* Строим от улицы внутрь: родитель обязан существовать раньше ребёнка,
            потому что отдаёт ему своё положение. */}
        <Frame
          layers={layers}
          index={layers.length - 1}
          depth={depth}
          target={target}
          outerScale={ground}
        />
      </div>
    </div>
  );
}

/**
 * Один план отъезда: рамка со своей скоростью и всё, что внутри неё.
 *
 * Прозрачностью КОНТЕЙНЕРА не управляем: она наследуется вложенными слоями, и
 * спрятанная улица утащила бы за собой и рабочее место. Поэтому невидимый слой
 * — это прозрачная кромка, а не прозрачный блок.
 */
function Frame({
  layers,
  index,
  depth,
  target,
  outerScale,
}: {
  layers: readonly string[];
  /** Номер плана от рабочего места (0) к улице. Он же — глубина в кадре. */
  index: number;
  /** Сколько тактов отъезда уже прошло. */
  depth: number;
  /** Общее для всех слоёв положение камеры на этом такте. */
  target: number;
  /** Положение рамки, внутри которой мы лежим. */
  outerScale: MotionValue<number>;
}) {
  const reduceMotion = useReducedMotion();
  const shown = depth >= index;
  const outer = index === layers.length - 1;

  // Собственное положение плана: он идёт к общей цели, но своим темпом.
  const scale = useMotionValue(target);
  useEffect(() => {
    const camera = animate(
      scale,
      target,
      // `ease.inOut` — у камеры есть масса: она разгоняется и тормозит. Кривая
      // появления здесь была бы враньём, потому что слои не появляются.
      calm(reduceMotion, tween(layerDuration(index, layers.length), ease.inOut)),
    );
    return () => camera.stop();
  }, [scale, target, index, layers.length, reduceMotion]);

  /**
   * ВЛОЖЕННЫЕ ТРАНСФОРМАЦИИ ПЕРЕМНОЖАЮТСЯ, и слой, применивший к себе своё
   * положение целиком, получил бы ещё и положение всех рамок над собой. Поэтому
   * на экран уходит ЧАСТНОЕ: своё, делённое на родительское. В покое оба равны
   * общей цели, частное обращается в единицу — и вложение выглядит нетронутым.
   */
  const own = useTransform([scale, outerScale], ([mine, around]: number[]) =>
    around ? mine / around : mine,
  );

  return (
    <motion.div
      // Четыре рамки зажигались разом и по 700 мс каждая — поверх отъезда это
      // шло отдельной медленной волной, длиннее любого экранного перехода в
      // приложении. Кромка и подпись — событие уровня экрана, им хватает
      // `dur.screen`. Переход сужен до цвета кромки: больше рамка ничего не
      // меняет, а `transition-colors` объявлял переходом и цвет текста внутри.
      className={cn(
        'relative grid place-items-center rounded-plate border p-5 transition-[border-color]',
        shown ? 'border-line' : 'border-transparent',
        outer && 'size-52',
      )}
      style={{ scale: own, transitionDuration: `${dur.screen}s` }}
    >
      <span
        className={cn(
          'legend absolute left-2 top-1 transition-opacity',
          shown ? 'text-ink-dim opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${dur.screen}s` }}
      >
        {layers[index]}
      </span>
      {index > 0 ? (
        <Frame
          layers={layers}
          index={index - 1}
          depth={depth}
          target={target}
          outerScale={scale}
        />
      ) : (
        <Desk />
      )}
    </motion.div>
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
        transition={calm(reduceMotion, {
          ...tween(dur.epic, ease.out),
          times: [0, 0.4, 0.6, 1],
        })}
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
