import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LIVES, QUESTIONS_PER_RUN } from '../content/quiz';
import type { QuizTopic } from '../content/types';
import { STEPS, type StepKey } from '../router/flow';
import type { ArtifactId } from '../world';

/**
 * Состояние прохождения воронки.
 *
 * Бэкенда нет: всё живёт в браузере и никуда не отправляется. Сохранение нужно
 * ровно для одного — чтобы человек, закрывший мини-апп на середине, вернулся
 * туда же, а не начал заново с ночного города.
 *
 * КЛЮЧ ХРАНИЛИЩА СМЕНЁН 11.08.2026 вместе с маршрутом. Прежний ключ
 * `traffic-town` хранит шаги старой воронки из тридцати одного шага; ни один
 * из них не существует в новой. Новый ключ просто не видит старую запись, и
 * человек начинает заново. Это осознанная потеря прогресса ровно один раз.
 */

interface FunnelState {
  step: StepKey;

  /**
   * Детали связки, которые уже собраны. Дублирует то, что можно вычислить из
   * шага, и это НАМЕРЕННО: деталь встаёт на место в момент анимации внутри
   * шага, а не в момент перехода на него. Карте нужен шаг, сборочной ленте —
   * факт.
   */
  artifacts: ArtifactId[];

  // --- Проверка перед лабораторией ---
  lives: number;
  /** Индексы вопросов в текущем проходе: перемешиваются при повторе. */
  order: number[];
  /** Позиция в `order`. */
  cursor: number;
  /** Сколько ошибок в каждой теме — по ним выбираем, что пересматривать. */
  mistakes: Record<QuizTopic, number>;
  /** Тест пройден хотя бы раз: дверь лаборатории больше не закрывается. */
  passed: boolean;
  /** Куда вернуть человека после пересмотра видео. */
  returnTo: StepKey | null;

  /** Человек открывал показанный сайт. Только после этого появляется цена. */
  proofOpened: boolean;

  goTo: (step: StepKey) => void;
  assemble: (artifact: ArtifactId) => void;
  openProof: () => void;

  startQuiz: () => void;
  answer: (correct: boolean, topic: QuizTopic) => void;
  pass: () => void;
  /** Тема, в которой человек ошибался больше. При равенстве — `audience`. */
  weakestTopic: () => QuizTopic;
  /** Уйти пересматривать видео: запоминает, что вернуться надо в тест. */
  reviewVideo: (step: StepKey) => void;
  /** Вернуться в тест с полными жизнями и перемешанными вопросами. */
  restartQuiz: () => void;
  reset: () => void;
}

/** Перемешивание Фишера — Йетса. Порядок вопросов при повторе должен меняться. */
function shuffled(count: number): number[] {
  const list = Array.from({ length: count }, (_, i) => i);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const initial = {
  step: STEPS[0],
  artifacts: [] as ArtifactId[],
  lives: LIVES,
  order: [] as number[],
  cursor: 0,
  mistakes: { audience: 0, offer: 0 } as Record<QuizTopic, number>,
  passed: false,
  returnTo: null as StepKey | null,
  proofOpened: false,
};

export const useFunnel = create<FunnelState>()(
  persist(
    (set, get) => ({
      ...initial,

      goTo: (step) => set({ step }),

      assemble: (artifact) =>
        set((s) =>
          s.artifacts.includes(artifact) ? s : { artifacts: [...s.artifacts, artifact] },
        ),

      openProof: () => set({ proofOpened: true }),

      startQuiz: () =>
        set({
          lives: LIVES,
          order: shuffled(QUESTIONS_PER_RUN),
          cursor: 0,
          mistakes: { audience: 0, offer: 0 },
        }),

      answer: (correct, topic) =>
        set((s) => ({
          lives: correct ? s.lives : Math.max(0, s.lives - 1),
          cursor: s.cursor + 1,
          mistakes: correct
            ? s.mistakes
            : { ...s.mistakes, [topic]: s.mistakes[topic] + 1 },
        })),

      pass: () => set({ passed: true }),

      // При равенстве ведём на аудиторию: она первична, офферы без неё
      // не собираются.
      weakestTopic: () => {
        const { mistakes } = get();
        return mistakes.offer > mistakes.audience ? 'offer' : 'audience';
      },

      reviewVideo: (step) => set({ step, returnTo: 'test' }),

      restartQuiz: () =>
        set({
          step: 'test',
          returnTo: null,
          lives: LIVES,
          order: shuffled(QUESTIONS_PER_RUN),
          cursor: 0,
          mistakes: { audience: 0, offer: 0 },
        }),

      reset: () => set({ ...initial }),
    }),
    {
      name: 'traffic-town-v2',
      version: 1,
      // Порядок вопросов и позицию в нём не сохраняем: возвращаться в середину
      // теста через сутки бессмысленно, тест начинается заново.
      partialize: (s) => ({
        step: s.step,
        artifacts: s.artifacts,
        passed: s.passed,
        proofOpened: s.proofOpened,
      }),
      /**
       * Страховка на случай, если сохранённый шаг больше не существует в
       * маршруте (правка `STEPS` между выкатами). Молча оставить неизвестный
       * ключ нельзя: `SCREENS[step]` вернёт `undefined` и приложение покажет
       * белый экран — ровно тот отказ, который человек не сможет обойти.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<FunnelState>;
        const stepIsKnown = saved.step != null && STEPS.includes(saved.step);
        return {
          ...current,
          ...saved,
          step: stepIsKnown ? (saved.step as StepKey) : current.step,
        };
      },
    },
  ),
);
