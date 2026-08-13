import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { preframe, preframeBeats, type PreframeCue } from '@/content/preframe';
import { SceneShell } from '@/scene/SceneShell';
import { calm, dur, ease, spring, stagger, tween } from '@/scene/motion';
import { useVoice } from '@/scene/useVoice';
import { useNav } from '@/router/useNav';
import { env } from '@/lib/env';
import { introAsset } from '@/ui/assets';
import { AdConsole } from '@/ui/AdConsole';
import { AuthorLine, AuthorNote } from '@/ui/AuthorNote';
import { MetalPanel } from '@/ui/MetalPanel';
import { Legend, Plate } from '@/ui/Plate';
import { SourceGrid } from '@/ui/SourceGrid';
import { vibrate } from '@/lib/telegram';
import { HOME_SOURCE, SOURCES, type SourceId } from '@/world';
import { cn } from '@/lib/cn';

/**
 * Состояние 1. Вход в Город трафика.
 *
 * ОДНА СЦЕНА НА ПОЛТОРЫ МИНУТЫ, И НИ ОДНОГО ЛИШНЕГО НАЖАТИЯ. Прежняя воронка
 * резала эту же мысль на девять экранов с кнопкой «дальше» под каждым; здесь
 * автор говорит, город иллюстрирует сказанное, а главное действие появляется
 * ровно один раз — когда сцена договорила (docs/SPEC.md §2.1).
 *
 * ОТДЕЛЬНОГО ЭКРАНА ВХОДА БОЛЬШЕ НЕТ (13.08.2026). Был: сначала переписка с
 * пришедшим голосовым, потом, после нажатия, город. Заказчик попросил ровно
 * обратного — «он нажимает Play, и в этот момент сам город начинает оживать».
 * Поэтому первый кадр — та же афиша, что и весь рассказ: город, автор в кадре,
 * первая реплика и плеер на нуле. Согласие слушать по-прежнему обязательно, но
 * оно даётся ВНУТРИ города, а не на подступах к нему (`SceneShell`).
 *
 * КАДРЫ ПЕРЕСОБРАНЫ ПОД АФИШУ. Раньше каждый такт рисовал себе целую сцену:
 * панораму города в рамке, портрет автора, вывеску над силуэтом. Теперь город
 * стоит фоном на весь экран, а автор — вырезанной фигурой слева, и всё это
 * задаётся ДВУМЯ полями (`city`, `figure`). Кадру такта остаётся витрина справа
 * от автора — то, что город показывает прямо сейчас: окна кабинета, претензии
 * клиента, связка. Дубли (кадр города внутри кадра города, второй портрет
 * автора рядом с фигурой автора) убраны, а не ужаты.
 *
 * ПРАВИЛО КАДРА НЕ ИЗМЕНИЛОСЬ. Город показывает ТО ЖЕ, ЧТО СЛЫШНО, и ни на шаг
 * вперёд. Ни один кадр здесь не произносит фразу, которой нет в записи: всё,
 * что человек прочитает, приходит из `src/content/preframe.ts` и из карты мира
 * (`src/world.ts`). В компоненте нет ни одной строки копирайта.
 */
export function PreframeScreen() {
  const { next } = useNav();
  /**
   * Запись лежит в самой сборке, а переменная сборки её ПЕРЕКРЫВАЕТ.
   *
   * Голос — часть продукта, а не внешняя ссылка: он должен ехать вместе с
   * приложением и работать без единой настройки. Переменная оставлена, чтобы
   * подменить запись, не пересобирая проект, — например, выложить новую версию
   * начитки и сравнить.
   */
  const voice = useVoice(
    preframeBeats,
    env.VITE_VOICE_INTRO_URL || introAsset('voice.m4a'),
  );
  const cue = voice.run.current.cue;

  /**
   * ЧТО ЗА ЦИФРА СТОИТ В ПЛЕЕРЕ ДО ЗАПИСИ.
   *
   * Пока файла нет, длину брать неоткуда — и приложение НЕ ИМЕЕТ ПРАВА её
   * придумать: выдуманный таймкод ничем не отличается от выдуманного CPL. Но и
   * прочерк врал бы в другую сторону: хронометраж известен, его задал автор
   * (`plannedDuration`). Появится файл — `duration` придёт из метаданных и
   * вытеснит объявленное значение. Цифра всегда либо настоящая, либо названная
   * автором.
   */
  const duration = voice.duration > 0 ? voice.duration : preframe.voice.plannedDuration;

  return (
    <SceneShell
      run={voice.run}
      total={preframeBeats.length}
      voice={{
        available: voice.available,
        started: voice.started,
        playing: voice.playing,
        position: voice.position,
        duration,
        start: voice.start,
        toggle: voice.toggle,
        seek: voice.seek,
      }}
      startCta={preframe.voice.cta}
      city={cityOf(cue)}
      figure={figureOf(cue)}
      stage={<PreframeStage index={voice.run.index} cue={cue} />}
      cta={preframe.cta}
      onCta={next}
    />
  );
}

/**
 * Какой кадр города стоит за рассказом.
 *
 * ГОРОД МЕНЯЕТСЯ ТРИЖДЫ ЗА ВСТУПЛЕНИЕ, И РОВНО НА ПОВОРОТАХ МЫСЛИ. Присланных
 * кадров три, и они не взаимозаменяемы: на одном крупно стоит район Директа, на
 * другом виден весь город с районами соседних систем, на третьем — район
 * конверсий, куда ведёт следующий шаг воронки.
 *
 *  · пока речь о работе, претензиях и обвинении — человек внутри СВОЕГО района;
 *  · когда автор говорит о разнице в чеке и о соседних кабинетах — камера видит
 *    ВЕСЬ город: именно о нём и речь;
 *  · на цене услуги и «погнали» — район конверсий на горизонте. Обещание пути
 *    даётся картинкой раньше, чем кнопкой, и оно честное: это буквально
 *    следующее место воронки.
 */
function cityOf(cue: PreframeCue): string {
  if (cue === 'money' || cue === 'go') return 'city-2.webp';
  if (cue === 'city' || cue === 'console' || cue === 'claim' || cue === 'blame') {
    return 'city-3.webp';
  }
  return 'city-1.webp';
}

/**
 * Какой из двух присланных портретов стоит в кадре.
 *
 * ФИГУРА ПОСТОЯННА ПОЧТИ ВЕСЬ РАССКАЗ, и это главное: автор ведёт экскурсию, а
 * не появляется на пару тактов. Зовущий кадр (палец в камеру, колба в руке) и
 * есть тот жест, которым он показывает город.
 *
 * ИСКЛЮЧЕНИЕ ОДНО — такт, где автор говорит о себе: «я хочу помочь тебе
 * разобраться». Указующий палец поверх этой фразы читается как продажа, а не
 * как предложение помощи, поэтому там стоит спокойный кадр с ноутбуком.
 * Подмена фигуры на одной подсказке из десяти работает как смена плана в
 * монтаже: её замечают ровно там, где она значит.
 */
function figureOf(cue: PreframeCue): string {
  return cue === 'author' ? 'author-desk.webp' : 'author.webp';
}

/**
 * Стекло витрины: подложка для всего, что на афише не имеет своей плоскости.
 *
 * ЗАЧЕМ ОНА НУЖНА, ХОТЯ РАНЬШЕ НЕ БЫЛА. Прежде витрина стояла в коробке на
 * ровном фоне сцены, и текст на нём читался всегда. Теперь под ней идёт
 * фотография ночного города с вывесками и фарами: та же строка проходит то по
 * чёрному небу, то по светящейся вывеске, и контраст меняется по буквам.
 * Проверено глазами — четыре вопроса связки и врезка автора над районом
 * конверсий не читались вовсе.
 *
 * ФОРМА ВЗЯТА У КАРТОЧКИ ГОЛОСОВОГО И РАМЫ (`bg-scene-deep/…` плюс размытие):
 * на афише все плоскости обязаны быть одного материала, иначе экран
 * рассыпается на разностилевые наклейки. Панелям из металла подложка не нужна —
 * у них своя плоскость.
 */
const GLASS = 'rounded-panel border border-line bg-scene-deep/72 backdrop-blur-md';

/**
 * Подпись прибора поверх города — та же подложка, но по размеру подписи.
 * Тянуть под одну строку целую панель было бы тяжелее самой строки.
 */
function Caption({ children, tone }: { children: ReactNode; tone?: 'dim' | 'neon' }) {
  return (
    <Legend
      tone={tone}
      className="rounded-plate bg-scene-deep/72 px-2 py-1 text-right backdrop-blur-md"
    >
      {children}
    </Legend>
  );
}

/**
 * Сколько тактов с этой подсказкой уже прошло, считая текущий.
 *
 * Нужен там, где ОДНА подсказка держит несколько тактов и должна за это время
 * что-то менять: претензии клиента приходят по одной, указатели обвинения
 * сходятся один за другим, вопросы связки проявляются ровно тогда, когда их
 * называют вслух. Считаем по порядку тактов, а не по их `id`: сценарий правится
 * текстом, и экран не должен ломаться от переименованного такта.
 */
function cueOrdinal(index: number, cue: PreframeCue): number {
  let n = -1;
  for (let i = 0; i <= index; i++) {
    if (preframeBeats[i].cue === cue) n++;
  }
  return Math.max(0, n);
}

/**
 * Витрина такта.
 *
 * ВЫРАВНИВАНИЕ ПО ПРАВОМУ КРАЮ И ПО ВЕРХУ — не вкус, а следствие композиции:
 * слева внизу стоит автор, а снизу текст. Свободен верхний правый угол афиши, и
 * всё, что показывает город, живёт там.
 *
 * ПУСТАЯ ВИТРИНА — ЗАКОННОЕ СОСТОЯНИЕ. На последних тактах в кадре только автор,
 * зовущий за собой, и город за его спиной; дорисовывать туда схему значило бы
 * отвлекать от единственного, что в этот момент происходит.
 */
function PreframeStage({ index, cue }: { index: number; cue: PreframeCue }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        // Ключ — подсказка, а не номер такта: пока город показывает одно и то
        // же, витрина не должна мигать на каждой реплике. Кабинет листает окна
        // семь тактов подряд и переживает их без единой перерисовки.
        key={cue}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={calm(reduceMotion, tween(dur.base))}
        className="flex flex-col items-end gap-3"
      >
        {cue === 'city' && <DistrictScene lit={cueOrdinal(index, 'city') > 0} />}
        {cue === 'console' && <ConsoleScene />}
        {cue === 'claim' && <ClaimScene shown={cueOrdinal(index, 'claim')} />}
        {cue === 'blame' && <BlameScene beat={cueOrdinal(index, 'blame')} />}
        {cue === 'author' && <AuthorScene />}
        {cue === 'gap' && <GapScene beat={cueOrdinal(index, 'gap')} />}
        {cue === 'tools' && <ToolsScene alone={cueOrdinal(index, 'tools') > 0} />}
        {cue === 'wider' && <WiderScene beat={cueOrdinal(index, 'wider')} />}
        {cue === 'money' && <MoneyScene raised={cueOrdinal(index, 'money') > 0} />}
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Такт 1–2. Район, с которого всё начинается
// ---------------------------------------------------------------------------

/**
 * Вывеска района героя.
 *
 * ПАНОРАМЫ ЗДЕСЬ БОЛЬШЕ НЕТ, И ЭТО НЕ ПОТЕРЯ. Раньше такт рисовал кадр города в
 * рамке; теперь город и так стоит на весь экран за спиной автора — рамка внутри
 * него была бы кадром внутри кадра. Осталось ровно то, чего в фоне нет: имя
 * района, зажигающееся тогда, когда его называют вслух.
 *
 * ЗАЖИГАЕТСЯ СО ВТОРОГО ТАКТА. Сначала «добро пожаловать в Город трафика» —
 * панорама и ничего больше; тактом позже «один район ты уже знаешь». Показать
 * вывеску сразу значило бы ответить на вопрос до того, как он прозвучал.
 *
 * Имя района берётся из `HOME_SOURCE`: район — это карта мира, и второй
 * экземпляр его названия однажды разъедется с первым. Светится он законно —
 * рекламный кабинет был у человека всегда, `zoneState('traffic')` здесь `open`.
 */
function DistrictScene({ lit }: { lit: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={false}
      // Неон включается не плавно, а с перебоем: так зажигается вывеска.
      animate={reduceMotion || !lit ? { opacity: lit ? 1 : 0 } : { opacity: [0, 1, 0.3, 1] }}
      transition={calm(reduceMotion, {
        ...tween(dur.epic, ease.out),
        times: [0, 0.4, 0.6, 1],
      })}
      className="flex flex-col items-end gap-2"
    >
      <MetalPanel className="px-4 py-2.5">
        <span className="neon-ink font-display text-lg font-semibold uppercase tracking-wide">
          {HOME_SOURCE.name}
        </span>
      </MetalPanel>
      <Caption>{preframe.district}</Caption>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Такт 3–4 и 9–15. Кабинет листает сам себя
// ---------------------------------------------------------------------------

/**
 * Рабочее место директолога.
 *
 * ОДИН И ТОТ ЖЕ КАДР ДВАЖДЫ, И ЭТО ТОЧНО ПО ЗАПИСИ. Сначала «ты работаешь с
 * кампаниями, чистишь запросы и площадки» — обычная неделя. Потом приходит
 * претензия клиента, и человек ОТКРЫВАЕТ ТОТ ЖЕ КАБИНЕТ ЗАНОВО, чтобы
 * перепроверить всё то же самое. Между ними стоит подсказка `claim`, поэтому
 * витрина честно перемонтируется и окна начинают листаться с первого — ровно
 * как заново открытый кабинет.
 *
 * Подписи здесь нет: всё, что можно сказать словами, сказано голосом рядом.
 */
function ConsoleScene() {
  return <AdConsole windows={preframe.console} className="w-full" />;
}

// ---------------------------------------------------------------------------
// Такт 5–8. Претензии клиента
// ---------------------------------------------------------------------------

/** Узор вибрации: короткий толчок, пауза, второй. Так дёргается телефон. */
const BUZZ = [18, 70, 26];

/**
 * Три претензии приходят пузырями, одна за другой.
 *
 * ПО ОДНОЙ, А НЕ СПИСКОМ. Автор произносит их подряд как чужую речь, и вся их
 * сила в накоплении: первая — рабочий момент, третья — уже приговор. Выложенные
 * разом, они превращаются в перечень претензий из методички.
 *
 * ПУЗЫРИ ПРИЖАТЫ ВПРАВО, а хвостик у них левый: это входящие сообщения, но
 * висят они в правом верхнем углу афиши, потому что левый занят автором. Форма
 * пузыря говорит «чужая речь» сильнее, чем сторона экрана.
 *
 * ТОЧКИ «ПЕЧАТАЕТ» СТОЯТ МЕЖДУ ПУЗЫРЯМИ, а не только перед первым: пока клиент
 * не договорил, кадр обязан показывать, что сейчас прилетит ещё. После третьей
 * они гаснут — больше ничего не придёт, и ждать нечего.
 *
 * Оформление намеренно выпадает из мира: палитра мессенджера (`--color-tg-*`),
 * ни неона, ни металла, ни жёлтой ленты. Узнать свою переписку человек должен
 * раньше, чем заметит стилизацию (docs/SPEC.md §3.3).
 */
function ClaimScene({ shown }: { shown: number }) {
  const reduceMotion = useReducedMotion();

  /**
   * Телефон дёргается на каждом прилетевшем пузыре. Вибрация — усиление
   * события, а не его носитель: вне Telegram на iOS её не будет вовсе.
   */
  useEffect(() => {
    if (shown > 0) vibrate(BUZZ);
  }, [shown]);

  return (
    <div className="flex flex-col items-end gap-2">
      {preframe.claims.slice(0, shown).map((claim) => (
        <motion.p
          key={claim}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={calm(reduceMotion, {
            y: spring.land,
            scale: spring.land,
            opacity: tween(dur.press),
          })}
          className="rounded-2xl rounded-tl-sm bg-tg-in px-3.5 py-2.5 text-small leading-relaxed text-tg-ink shadow-[0_18px_40px_-16px_#000]"
        >
          {claim}
        </motion.p>
      ))}

      {shown < preframe.claims.length && <TypingDots reduceMotion={Boolean(reduceMotion)} />}
    </div>
  );
}

/**
 * Три бегущие точки в пустом пузыре.
 *
 * ПОДПИСИ РЯДОМ НЕТ И БЫТЬ НЕ МОЖЕТ: слова «печатает…» в сценарии заказчика не
 * произносятся, а придумывать реплику на экране запрещено. Точки же ничего не
 * говорят — они показывают, и потому спрятаны от экранного диктора: человеку,
 * который слушает, ровно в этот момент читают саму претензию.
 */
function TypingDots({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-tg-in px-3.5 py-3"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-tg-dim"
          animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 1, repeat: Infinity, delay: i * stagger.reveal, ease: 'easeInOut' }
          }
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Такт 16–20. Крайним остаёшься ты
// ---------------------------------------------------------------------------

/**
 * Куда показывают пальцем. Три указателя сходятся на одной вывеске: слева,
 * сверху, справа. Координаты в системе кадра 320×160 и подобраны так, чтобы
 * остриё не наезжало на табличку — она примерно 186 пикселей шириной.
 *
 * `from` — откуда указатель приезжает и куда уходит, когда клиент разворачивается
 * и уходит совсем.
 */
const AIMS = [
  { line: 'M 10 80 L 40 80', head: '40,74 52,80 40,86', from: { x: -22, y: 0 } },
  { line: 'M 160 6 L 160 36', head: '154,36 166,36 160,48', from: { x: 0, y: -22 } },
  { line: 'M 310 80 L 280 80', head: '280,74 268,80 280,86', from: { x: 22, y: 0 } },
] as const;

/**
 * Обвинение крупно.
 *
 * ЧТО ЗДЕСЬ ИЗОБРАЖЕНО БУКВАЛЬНО. «Лиды плохие — смотрим Директ. Продаж мало —
 * смотрим Директ». В кадре стоит ровно та вывеска, на которую показывают, и в
 * неё по одному втыкаются указатели — по указателю на такт. Жёлтая табличка
 * означает в этом мире опасность и разбирательство (docs/SPEC.md §5.3), и это
 * единственное место вступления, где она уместна.
 *
 * НА ТАКТЕ «КЛИЕНТ УХОДИТ» УКАЗАТЕЛИ УЕЗЖАЮТ ОБРАТНО ЗА КРАЙ. Не гаснут, а
 * именно уходят — тем же путём, которым пришли. Табличка остаётся стоять одна:
 * претензий больше нет, потому что спрашивать стало некому.
 */
function BlameScene({ beat }: { beat: number }) {
  const reduceMotion = useReducedMotion();
  // Три указателя на три первых такта, дальше клиент разворачивается.
  const aimed = Math.min(beat + 1, AIMS.length);
  const gone = beat >= AIMS.length;

  return (
    <div className="relative aspect-[2/1] w-full">
      <svg
        viewBox="0 0 320 160"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        {AIMS.slice(0, aimed).map((aim) => (
          <motion.g
            key={aim.line}
            initial={reduceMotion ? false : { opacity: 0, x: aim.from.x, y: aim.from.y }}
            animate={{
              opacity: gone ? 0 : 1,
              x: gone ? aim.from.x : 0,
              y: gone ? aim.from.y : 0,
            }}
            // У указателя есть масса: он приезжает и уезжает по кадру, а не
            // появляется и исчезает на месте.
            transition={calm(reduceMotion, tween(dur.screen, ease.inOut))}
          >
            <path
              d={aim.line}
              stroke="var(--color-alarm)"
              strokeWidth={2}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            <polygon points={aim.head} fill="var(--color-alarm)" />
          </motion.g>
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Plate>
          <span className="font-display text-base font-semibold uppercase tracking-wide">
            {HOME_SOURCE.name}
          </span>
        </Plate>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 21–22. Автор говорит о себе
// ---------------------------------------------------------------------------

/**
 * Врезка автора.
 *
 * ПОРТРЕТА ЗДЕСЬ БОЛЬШЕ НЕТ: автор и так стоит в кадре во весь рост всю сцену.
 * Второе его изображение рядом с первым читалось бы как двойник. Осталась
 * врезка — та же форма, которой автор говорит во всей воронке: увидел кромку и
 * уже знаешь, кто говорит. На этом такте меняется сама фигура (см. `figureOf`),
 * и врезка объясняет, почему она сменилась.
 */
function AuthorScene() {
  return (
    <div className={cn(GLASS, 'w-full p-3')}>
      <AuthorNote>
        <AuthorLine>{preframe.authorNote}</AuthorLine>
      </AuthorNote>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 23–25. Два специалиста и разница в чеке
// ---------------------------------------------------------------------------

/**
 * Разница в чеке между двумя одинаково знающими Директ.
 *
 * ПОРЯДОК РАСКРЫТИЯ ПОВТОРЯЕТ ВОПРОС. Сначала в кадре два одинаковых человека и
 * никаких цифр — именно это и утверждает первая реплика: «примерно одинаково
 * хорошо разбираются». Чек появляется вторым тактом, когда его называют, и
 * только тогда правая фигура загорается. Третьим приходит оговорка про
 * настройки — то есть ровно тогда, когда её произносят.
 *
 * Цифры названы автором в записи и живут в контенте. Придумывать здесь нечего:
 * ни своих сумм, ни процентов, ни «в 4 раза больше» — этой арифметики в записи
 * нет, а есть прямое отрицание, и оно лежит в `preframe.gap.note`.
 */
function GapScene({ beat }: { beat: number }) {
  const reduceMotion = useReducedMotion();
  const { left, right, note } = preframe.gap;
  const paid = beat > 0;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <SpecialistPanel fee={left.fee} caption={left.caption} shown={paid} />
        <SpecialistPanel fee={right.fee} caption={right.caption} shown={paid} lit={paid} />
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: beat > 1 ? 1 : 0 }}
        transition={calm(reduceMotion, tween(dur.screen))}
        className="self-end"
      >
        <Caption>{note}</Caption>
      </motion.div>
    </div>
  );
}

/**
 * Один специалист: фигура, чек, за что отвечает.
 *
 * Фигура собрана из двух блоков и намеренно безлика — это не портрет, а «такой
 * же, как ты». Свет достаётся только правой, и только после того, как названа
 * её цена: неон в этом мире означает «уже твоё», а не «лучше» (SPEC §5.2), и
 * здесь он говорит, что второй специалист владеет большим участком пути.
 */
function SpecialistPanel({
  fee,
  caption,
  shown,
  lit = false,
}: {
  fee: string;
  caption: string;
  /** Чек назван вслух. До этого в кадре только две одинаковые фигуры. */
  shown: boolean;
  lit?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <MetalPanel className="flex flex-col items-center gap-1.5 p-2.5">
      <span aria-hidden="true" className="flex flex-col items-center gap-1">
        <span
          className={cn(
            'size-3.5 rounded-full transition-colors',
            lit ? 'bg-neon-dim' : 'bg-metal-hi',
          )}
          style={{ transitionDuration: `${dur.screen}s` }}
        />
        <span
          className={cn(
            'h-4 w-8 rounded-t-full transition-colors',
            lit ? 'bg-neon-dim' : 'bg-metal-hi',
          )}
          style={{ transitionDuration: `${dur.screen}s` }}
        />
      </span>

      <motion.span
        initial={false}
        animate={{ opacity: shown ? 1 : 0 }}
        transition={calm(reduceMotion, tween(dur.base))}
        className={cn(
          'font-display text-lead font-semibold',
          lit ? 'neon-ink' : 'text-ink',
        )}
      >
        {fee}
      </motion.span>

      <Legend tone={lit ? 'neon' : 'dim'} className="text-center">
        {caption}
      </Legend>
    </MetalPanel>
  );
}

// ---------------------------------------------------------------------------
// Такт 26–27. Соседние кабинеты
// ---------------------------------------------------------------------------

/** Все районы разом — порядок загорания задаёт карта, а не кадр. */
const ALL_SOURCES: readonly SourceId[] = SOURCES.map((source) => source.id);

/** Только свой. Тот же список, урезанный до района героя. */
const HOME_ONLY: readonly SourceId[] = [HOME_SOURCE.id];

/**
 * Соседние кабинеты: VK, Авито, Telegram Ads.
 *
 * ПЛИТКИ ГАСНУТ, И ЭТО ВЕСЬ КАДР. Первым тактом загораются все четыре района —
 * так выглядит соблазн, который автор перечисляет вслух («секрет не в том, что
 * тебе срочно нужно изучить…»). Вторым тактом соседи гаснут, и остаётся тот
 * единственный, в котором человек живёт: дело не в количестве кабинетов, которые
 * ты умеешь открывать.
 *
 * Флейты в кадре нет намеренно. Она в записи шутка, а нарисованная — превратится
 * в ребус, который человек будет разгадывать вместо того, чтобы слушать.
 */
function ToolsScene({ alone }: { alone: boolean }) {
  return <SourceGrid lit={alone ? HOME_ONLY : ALL_SOURCES} className="w-full" />;
}

// ---------------------------------------------------------------------------
// Такт 28–34. Четыре вопроса, из которых собирается связка
// ---------------------------------------------------------------------------

/**
 * Сколько вопросов уже названо вслух на этом такте подсказки.
 *
 * ЖЁСТКО ПРИВЯЗАНО К РЕЧИ. Первые четыре такта подсказки говорят о результате
 * бизнеса и о том, за какой участок пути человек отвечает, — вопросов там ещё
 * нет, и в кадре стоят пустые строки с номерами. Пятый такт называет два
 * вопроса («кому мы льём», «почему покупает»), шестой — оставшиеся два. Кадр
 * обгонять голос не имеет права: пустая строка честнее, чем ответ, который ещё
 * не прозвучал.
 */
function askedBy(beat: number): number {
  if (beat >= 5) return 4;
  if (beat >= 4) return 2;
  return 0;
}

/**
 * Четыре вопроса на одной стойке.
 *
 * ПОЧЕМУ НОМЕРА СТОЯТ С САМОГО НАЧАЛА. Человеку показывают не список, а
 * КОНСТРУКЦИЮ: участков четыре, они уже есть, просто ты их пока не назвал.
 * Появление их по одному без мест сделало бы кадр перечислением, а на
 * перечислении не видно, что вопросы связаны между собой.
 *
 * Стойка слева зажигается последним тактом подсказки — на реплике про клик,
 * который превращается в деньги. Именно там четыре отдельных вопроса впервые
 * названы одной связкой, и до этого момента она гореть не должна.
 */
function WiderScene({ beat }: { beat: number }) {
  const reduceMotion = useReducedMotion();
  const asked = askedBy(beat);
  const linked = beat >= 6;

  return (
    <div className={cn(GLASS, 'relative flex w-full flex-col gap-2 py-3 pl-6 pr-3')}>
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-3 left-3 top-3 w-px transition-colors',
          linked ? 'bg-neon' : 'bg-line',
        )}
        style={{ transitionDuration: `${dur.screen}s` }}
      />

      {preframe.wider.map((question, i) => (
        <div key={question} className="flex items-baseline gap-2.5">
          <Legend tone={i < asked ? 'neon' : 'dim'}>{String(i + 1).padStart(2, '0')}</Legend>
          {i < asked ? (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={calm(reduceMotion, {
                ...tween(dur.base),
                // Вопросы называют парами, и внутри пары второй отстаёт на шаг
                // выкладки: так читается «и ещё вот это», а не «оба сразу».
                delay: (i % 2) * stagger.list,
              })}
              className="text-small text-ink"
            >
              {question}
            </motion.p>
          ) : (
            // Место занято, ответа нет. Прочерк — это «здесь будет вопрос», а
            // пустота была бы «здесь ничего нет».
            <span aria-hidden="true" className="h-px w-12 bg-line" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Такт 35–36. Меняется цена услуги
// ---------------------------------------------------------------------------

/**
 * Одно крупное утверждение: чек за работу.
 *
 * ЗДЕСЬ НЕТ И НЕ МОЖЕТ БЫТЬ ФРАЗЫ. Реплика «меняется то, какую услугу ты можешь
 * продавать и сколько она может стоить» звучит рядом заголовком; повторить её
 * крупным шрифтом значило бы объяснить картинкой то, что уже сказано словами.
 * Поэтому кадр не пересказывает реплику, а ПОКАЗЫВАЕТ ЕЁ ПРЕДМЕТ: та же пара
 * чисел из `preframe.gap`, но теперь это не двое чужих людей, а один человек
 * до и после.
 *
 * Смена — подменой узла, а не переливом цифр: чек не «подрос», а стал другим.
 * Пружина `spring.land` даёт короткий перелёт, каким приходит крупная мысль.
 */
function MoneyScene({ raised }: { raised: boolean }) {
  const reduceMotion = useReducedMotion();
  const side = raised ? preframe.gap.right : preframe.gap.left;

  return (
    <MetalPanel className="flex flex-col items-center gap-2 px-5 py-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={side.fee}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={calm(reduceMotion, spring.land)}
          className={cn(
            'font-display text-title font-semibold',
            raised ? 'neon-ink' : 'text-ink',
          )}
        >
          {side.fee}
        </motion.span>
      </AnimatePresence>

      <Legend tone={raised ? 'neon' : 'dim'} className="text-center">
        {side.caption}
      </Legend>
    </MetalPanel>
  );
}
