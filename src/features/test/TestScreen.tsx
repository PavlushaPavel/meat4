import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LIVES, quizBank, quizCopy } from '@/content/quiz';
import type { QuizQuestion, QuizTopic } from '@/content/types';
import { REVIEW_TARGET, type StepKey } from '@/router/flow';
import { useNav } from '@/router/useNav';
import { useFunnel } from '@/store/funnel';
import { ZONES, zoneState } from '@/world';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/CityStage';
import { worldAsset } from '@/ui/assets';
import { Lamp, MetalPanel } from '@/ui/MetalPanel';
import { Legend, Plate } from '@/ui/Plate';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

/**
 * Шаг 6. Закрытый вход в лабораторию и проверка перед ней.
 *
 * ГЛАВНОЕ ТРЕБОВАНИЕ, КОТОРОЕ ЗДЕСЬ РЕАЛИЗОВАНО: двенадцать вопросов — это ОДИН
 * экран приложения, а не двенадцать. Вопрос сменяется ВНУТРИ карточки, шапка со
 * счётчиком и жизнями остаётся на месте, маршрут воронки не двигается. Так
 * человек физически видит, что он не идёт дальше, а стоит перед дверью и
 * отвечает. Разбей это на шаги — и проверка превратится в ещё один коридор
 * воронки, из которого не страшно выйти.
 *
 * ФАЗЫ ВЫВЕДЕНЫ ИЗ СОСТОЯНИЯ, А НЕ ИЗ ФЛАГА «сейчас показываем вопрос». Своего
 * `useState('gate' | 'quiz' | …)` здесь нет намеренно: рассинхрон такого флага и
 * стора дал бы экран, который показывает вопрос при нулевых жизнях. Признак
 * запущенного прогона — непустой `order`, и он же решает вопрос возврата: после
 * пересмотра `useNav().next()` зовёт `restartQuiz()`, тот перемешивает `order`,
 * человек приходит сразу к первому вопросу и второй раз терминал не читает.
 * Отдельной логики возврата поэтому в файле нет.
 *
 * ЕДИНСТВЕННОЕ ЛОКАЛЬНОЕ СОСТОЯНИЕ — `answered`: отвеченный вопрос, замороженный
 * на время разбора. Он нужен потому, что `answer()` сразу двигает курсор и
 * жизни (иначе счётчик сердец не мог бы гаснуть в момент ошибки), а разбор
 * обязан продолжать показывать ТОТ вопрос, на который человек только что
 * ответил.
 */

/** Отвеченный вопрос, замороженный на время разбора. */
interface Answered {
  question: QuizQuestion;
  /** Что выбрал человек. Нужно, чтобы отметить его вариант в разборе. */
  chosen: string;
  correct: boolean;
  /** Номер вопроса в прогоне: счётчик в шапке не должен прыгать под разбором. */
  index: number;
}

export function TestScreen() {
  const { next } = useNav();
  const step = useFunnel((s) => s.step);
  const lives = useFunnel((s) => s.lives);
  const order = useFunnel((s) => s.order);
  const cursor = useFunnel((s) => s.cursor);
  const startQuiz = useFunnel((s) => s.startQuiz);
  const answer = useFunnel((s) => s.answer);
  const pass = useFunnel((s) => s.pass);
  const restartQuiz = useFunnel((s) => s.restartQuiz);
  const reviewVideo = useFunnel((s) => s.reviewVideo);
  const weakestTopic = useFunnel((s) => s.weakestTopic);
  const assemble = useFunnel((s) => s.assemble);

  const [answered, setAnswered] = useState<Answered | null>(null);

  const running = order.length > 0;
  const failed = running && lives <= 0;
  const finished = running && !failed && cursor >= order.length;
  const current = running ? quizBank[order[cursor]] : undefined;

  /**
   * Деталь ОФФЕР встаёт на место здесь. Карта считает это сама из шага
   * (`ZONE_SCHEDULE` в src/world.ts), но сборочной ленте нужен факт: участок
   * забран в тот момент, когда человек его увидел, а не когда шаг сменится.
   */
  useEffect(() => {
    assemble('offer');
  }, [assemble]);

  // Дверь открывается один раз и больше не закрывается. `pass()` вызывается
  // здесь, а не по нажатию «дальше»: человек мог закрыть мини-апп на экране
  // с открытыми дверями, и второй раз проходить тест он не должен.
  useEffect(() => {
    if (!finished) return;
    pass();
    track('test', { result: 'passed' });
  }, [finished, pass]);

  useEffect(() => {
    if (failed) track('test', { result: 'failed' });
  }, [failed]);

  function begin() {
    startQuiz();
    track('test', { result: 'start' });
  }

  function choose(question: QuizQuestion, optionId: string) {
    const correct = optionId === question.correctId;
    // Порядок важен: сначала заморозили вопрос, потом двинули стор. Иначе
    // разбор успел бы отрисоваться уже со следующим вопросом.
    setAnswered({ question, chosen: optionId, correct, index: cursor + 1 });
    answer(correct, question.topic);
    // Дословных ответов не отправляем — считаем прохождение, а не человека.
    track('test', {
      question: question.id,
      topic: question.topic,
      correct: correct ? 1 : 0,
      index: cursor + 1,
    });
  }

  /** Уйти пересматривать. Стор запомнит, что вернуться надо в тест. */
  function review(topic: QuizTopic) {
    const target: StepKey = REVIEW_TARGET[topic];
    track('test', { result: 'review', topic, target });
    reviewVideo(target);
  }

  // --- Фаза 1: терминал у закрытой двери ---
  if (!running) {
    return <GateView offerOpen={zoneState('offer', step) === 'open'} onStart={begin} />;
  }

  // --- Фаза 3: разбор (всегда, и после верного ответа тоже) ---
  if (answered) {
    return (
      <RunView
        index={answered.index}
        lives={lives}
        announce={
          answered.correct
            ? quizCopy.verdict.announceRight
            : quizCopy.verdict.announceWrong(lives)
        }
      >
        <VerdictCard
          key={`verdict-${answered.question.id}`}
          answered={answered}
          onNext={() => setAnswered(null)}
          onReview={() => review(answered.question.topic)}
        />
      </RunView>
    );
  }

  // --- Фаза 4: жизни кончились ---
  if (failed) {
    const topic = weakestTopic();
    return <FailedView topic={topic} onReview={() => review(topic)} onRestart={restartQuiz} />;
  }

  // --- Фаза 5: пройдено ---
  if (finished || !current) {
    return <PassedView onNext={next} />;
  }

  // --- Фаза 2: вопрос ---
  return (
    <RunView
      index={cursor + 1}
      lives={lives}
      announce={quizCopy.run.announce(cursor + 1, lives)}
    >
      <QuestionCard
        key={`question-${current.id}`}
        question={current}
        onChoose={(optionId) => choose(current, optionId)}
      />
    </RunView>
  );
}

// ---------------------------------------------------------------------------
// Фаза 1. Терминал у закрытой двери
// ---------------------------------------------------------------------------

function GateView({ offerOpen, onStart }: { offerOpen: boolean; onStart: () => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <Screen className="min-h-dvh justify-between gap-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Plate className="self-start">
            <span className="font-display text-title font-semibold uppercase leading-none">
              {quizCopy.gate.plate}
            </span>
          </Plate>
          {/* Красная лампа мигает сама и гаснет при prefers-reduced-motion:
              анимация объявлена в globals.css, а не здесь. */}
          <Lamp tone="alarm" label={quizCopy.gate.status} />
        </div>

        {/*
          Награда предыдущего шага: участок ОФФЕР стал твоим ровно на этом шаге.
          Состояние спрашивается у `zoneState`, флага «открыто» тут нет — забыть
          открыть участок и показать пустое место физически нельзя.
        */}
        {offerOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="neon-edge flex items-center justify-between gap-3 rounded-plate px-3 py-2"
          >
            <span className="flex flex-col">
              <span className="font-display text-sm font-semibold uppercase tracking-wide text-neon">
                {ZONES.offer.name}
              </span>
              <span className="text-legend text-ink-dim">{ZONES.offer.caption}</span>
            </span>
            <Legend tone="neon">{quizCopy.gate.zoneStatus}</Legend>
          </motion.div>
        )}

        <MetalPanel rivets className="flex flex-col gap-4 p-4">
          <Legend tone="dim">{quizCopy.gate.terminalLabel}</Legend>
          <div className="flex flex-col gap-3">
            {quizCopy.gate.terminal.map((line) => (
              <p key={line} className="text-base text-ink">
                {line}
              </p>
            ))}
          </div>
          <p className="font-display text-lead font-semibold uppercase leading-tight tracking-tight text-hazard">
            {quizCopy.gate.lead}
          </p>
          <div className="flex items-center gap-3 border-t border-line pt-3">
            <Legend tone="hazard">{quizCopy.gate.rules}</Legend>
          </div>
        </MetalPanel>
      </div>

      <Button variant="hazard" onClick={onStart}>
        {quizCopy.gate.cta}
      </Button>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Фазы 2 и 3. Один экран: шапка стоит, карточка меняется
// ---------------------------------------------------------------------------

/**
 * Каркас прогона. Шапка со счётчиком и жизнями не перерисовывается при смене
 * вопроса — меняется только содержимое карточки. Это и есть «один экран».
 *
 * Живая область для диктора ОДНА на весь прогон и живёт здесь, а не в карточках.
 * Две области (в вопросе и в разборе) на одном экране перебивали бы друг друга,
 * и человек слышал бы обрывки обеих.
 */
function RunView({
  index,
  lives,
  announce,
  children,
}: {
  index: number;
  lives: number;
  /** Что диктор говорит о текущем состоянии: номер, остаток жизней, вердикт. */
  announce: string;
  children: ReactNode;
}) {
  return (
    <Screen className="min-h-dvh gap-4">
      <header className="flex items-center justify-between gap-3">
        <Legend tone="dim">{quizCopy.run.counter(index)}</Legend>
        <Lives lives={lives} />
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/*
        Карточка одна на весь прогон. `AnimatePresence mode="wait"` меняет её
        содержимое: старое уходит, новое приходит — экран при этом на месте.
      */}
      <MetalPanel rivets className="overflow-hidden p-4">
        <AnimatePresence mode="wait" initial={false}>
          {children}
        </AnimatePresence>
      </MetalPanel>
    </Screen>
  );
}

/**
 * Счётчик жизней.
 *
 * Погашенная жизнь отличается не только цветом, но и ЗНАКОМ: закрашенное сердце
 * против контурного. Иначе человек, не различающий жёлтый и серый, теряет жизни
 * молча. Экранному диктору остаток жизней сообщает живая область в `RunView`
 * словами, поэтому сам ряд сердец от него скрыт: слушать «сердце сердце сердце»
 * двенадцать раз подряд незачем.
 */
function Lives({ lives }: { lives: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex items-center gap-2">
      <Legend tone="dim">{quizCopy.run.livesLabel}</Legend>
      <span aria-hidden="true" className="flex items-center gap-1">
        {Array.from({ length: LIVES }, (_, i) => {
          const alive = i < lives;
          return (
            <motion.span
              key={i}
              // Только что погасшая жизнь — та, что стоит сразу за остатком.
              // Она коротко вспыхивает аварийным и садится: заметно, но без
              // тряски всего экрана.
              animate={reduceMotion ? undefined : { scale: alive ? 1 : [1.35, 1] }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={cn('text-base leading-none', alive ? 'text-hazard' : 'text-ink-dim')}
            >
              {alive ? quizCopy.run.marks.alive : quizCopy.run.marks.lost}
            </motion.span>
          );
        })}
      </span>
    </div>
  );
}

function QuestionCard({
  question,
  onChoose,
}: {
  question: QuizQuestion;
  onChoose: (optionId: string) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Legend tone="dim">{quizCopy.run.situationLabel}</Legend>
        <p className="text-small text-ink-dim">{question.situation}</p>
      </div>

      <h2 className="font-display text-lead font-semibold uppercase leading-tight tracking-tight text-ink">
        {question.question}
      </h2>

      {/*
        Варианты — кнопки под палец, а не радиокнопки в строчку: отвечать
        придётся двенадцать раз одной рукой в метро.
      */}
      <ul className="flex flex-col gap-2">
        {question.options.map((option, i) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(option.id)}
              className="flex min-h-14 w-full items-start gap-3 rounded-plate border border-line bg-scene-deep/60 px-4 py-3 text-left transition-colors duration-150 active:border-hazard active:bg-metal"
            >
              <span aria-hidden="true" className="legend shrink-0 pt-1 text-hazard">
                {quizCopy.run.optionMarks[i]}
              </span>
              <span className="text-small text-ink">{option.text}</span>
            </button>
          </li>
        ))}
      </ul>

      <Legend tone="dim">{quizCopy.run.hint}</Legend>
    </motion.div>
  );
}

/**
 * Разбор. Показывается ВСЕГДА, в том числе после верного ответа: он объясняет
 * ход мысли, а не сообщает оценку. После ошибки добавляется кнопка пересмотра
 * — единственная дорога назад в нужную часть.
 */
function VerdictCard({
  answered,
  onNext,
  onReview,
}: {
  answered: Answered;
  onNext: () => void;
  onReview: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { question, chosen, correct } = answered;
  const right = question.options.find((o) => o.id === question.correctId);
  const picked = question.options.find((o) => o.id === chosen);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -14 }}
      transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <Lamp
          tone={correct ? 'ok' : 'alarm'}
          label={correct ? quizCopy.verdict.right : quizCopy.verdict.wrong}
        />
        {/*
          Цена ошибки. Заметно, но без издевательства: цифра приходит сверху и
          садится на место — ровно один раз, без тряски и без звука.
        */}
        {!correct && (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 1.25 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            className="font-display text-lead font-semibold leading-none text-alarm"
          >
            {quizCopy.verdict.cost}
          </motion.span>
        )}
      </div>

      {/*
        После ошибки на экране обязаны стоять ОБА варианта: выбранный и верный.
        Разбор говорит «здесь ты выбрал человека по внешнему признаку» — без
        двух текстов рядом это придётся восстанавливать по памяти, а человек
        уже держит в голове ситуацию на пять строк.
      */}
      {!correct && picked && (
        <div className="flex flex-col gap-2 rounded-plate border border-alarm/50 px-3 py-2">
          <Legend tone="alarm">{quizCopy.verdict.chosenAnswerLabel}</Legend>
          <p className="text-small text-ink-dim">{picked.text}</p>
        </div>
      )}
      {right && (
        <div
          className={cn(
            'flex flex-col gap-2 rounded-plate border px-3 py-2',
            correct ? 'border-line' : 'border-neon/60',
          )}
        >
          <Legend tone="neon">{quizCopy.verdict.rightAnswerLabel}</Legend>
          <p className={cn('text-small', correct ? 'text-ink-dim' : 'text-ink')}>{right.text}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Legend tone="dim">{quizCopy.verdict.explanationLabel}</Legend>
        <p className="text-base text-ink">{question.explanation}</p>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button variant="hazard" onClick={onNext}>
          {quizCopy.verdict.next}
        </Button>
        {!correct && (
          <Button variant="ghost" arrow={false} onClick={onReview}>
            {reviewLabel(question)}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Подпись кнопки пересмотра. Пока запись не смонтирована и `reviewAt === null`,
 * кнопка честно зовёт пересмотреть часть целиком. Появится секунда — покажет
 * время. Выдуманного таймкода здесь нет и быть не может.
 */
function reviewLabel(question: QuizQuestion): string {
  return question.reviewAt === null
    ? quizCopy.review.part[question.topic]
    : quizCopy.review.at(question.reviewAt);
}

// ---------------------------------------------------------------------------
// Фаза 4. Жизни кончились
// ---------------------------------------------------------------------------

/**
 * Провал. Тон здесь важнее вёрстки: человек ошибся пять раз и уже чувствует
 * себя плохо. Экран не оценивает его, а показывает АДРЕС — какую часть добрать.
 * Поэтому главное действие (жёлтое) — пересмотреть, а не «попробовать снова»:
 * второй заход без пересмотра даст те же пять ошибок и тот же экран.
 */
function FailedView({
  topic,
  onReview,
  onRestart,
}: {
  topic: QuizTopic;
  onReview: () => void;
  onRestart: () => void;
}) {
  return (
    <Screen className="min-h-dvh justify-between gap-6">
      <div className="flex flex-col gap-5">
        <Plate className="self-start">
          <span className="font-display text-lead font-semibold uppercase leading-none">
            {quizCopy.failed.plate}
          </span>
        </Plate>
        <Lamp tone="alarm" label={quizCopy.failed.status} />

        <MetalPanel rivets className="flex flex-col gap-3 p-4">
          {quizCopy.failed.blocks.map((line) => (
            <p key={line} className="text-base text-ink">
              {line}
            </p>
          ))}
          <p className="border-t border-line pt-3 text-small text-ink-dim">
            {quizCopy.failed.weakest[topic]}
          </p>
        </MetalPanel>
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="hazard" arrow={false} onClick={onReview}>
          {quizCopy.review.part[topic]}
        </Button>
        <Button variant="ghost" arrow={false} onClick={onRestart}>
          {quizCopy.failed.restart}
        </Button>
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Фаза 5. Пройдено: двери открываются
// ---------------------------------------------------------------------------

function PassedView({ onNext }: { onNext: () => void }) {
  return (
    <Screen className="min-h-dvh justify-between gap-6">
      <div className="flex flex-col gap-5">
        <Lamp tone="ok" label={quizCopy.passed.status} />

        <Doors>
          {/*
            Створки — декорация поверх вывески, а не её замена: вывеска остаётся
            в разметке и достаётся диктору сразу, не дожидаясь конца анимации.
          */}
          <h1 className="neon-ink text-balance font-display text-title font-semibold uppercase leading-none tracking-tight">
            {quizCopy.passed.title}
          </h1>
        </Doors>

        <div className="flex flex-col gap-3">
          {quizCopy.passed.blocks.map((line) => (
            <p key={line} className="text-base text-ink">
              {line}
            </p>
          ))}
        </div>
      </div>

      <Button variant="hazard" onClick={onNext}>
        {quizCopy.passed.cta}
      </Button>
    </Screen>
  );
}

/**
 * Двери лаборатории. Две металлические створки с опасной лентой по шву
 * разъезжаются и открывают неоновую вывеску.
 *
 * При `prefers-reduced-motion` створки не анимируются, а сразу стоят открытыми:
 * `initial={false}` заставляет motion взять конечное положение как начальное.
 * Разметка при этом та же — гасится движение, а не событие.
 */
function Doors({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative isolate min-h-40 overflow-hidden rounded-panel border border-line bg-scene-deep">
      {/*
        За створками стоит сборочный цех — то, ради чего дверь и была заперта.
        Пустота за открывшейся дверью обесценила бы весь пройденный тест: человек
        двенадцать вопросов шёл смотреть, что там, и обязан что-то увидеть.

        Кадр приглушён и накрыт затемнением: поверх него стоит неоновый
        заголовок, и контраст текста важнее насыщенности картинки.
      */}
      <img
        src={worldAsset('assembly-room.webp')}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-scene-deep/55" aria-hidden="true" />

      <div className="relative flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
        {children}
      </div>

      {[-1, 1].map((dir) => (
        <motion.div
          key={dir}
          aria-hidden="true"
          className={cn(
            'metal-panel metal-rivets absolute inset-y-0 w-1/2',
            dir < 0 ? 'left-0' : 'right-0',
          )}
          initial={reduceMotion ? false : { x: 0 }}
          animate={{ x: `${dir * 101}%` }}
          transition={{
            duration: reduceMotion ? 0 : 0.9,
            delay: reduceMotion ? 0 : 0.25,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {/* Шов, по которому дверь была запечатана. */}
          <span
            className={cn(
              'hazard-worn absolute inset-y-0 w-2',
              dir < 0 ? 'right-0' : 'left-0',
            )}
          />
        </motion.div>
      ))}
    </div>
  );
}
