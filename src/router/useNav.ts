import { useFunnel } from '@/store/funnel';
import { nextStep, type StepKey } from './flow';

/**
 * Переход по маршруту.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ХУК, А НЕ `goTo(nextStep(step))` НА КАЖДОМ ЭКРАНЕ. Из-за
 * пересмотра. Ошибившись в проверке, человек уходит назад — в первую или
 * вторую главу — и оттуда «дальше» обязано вернуть его В ПРОВЕРКУ, а не
 * повести по маршруту второй раз. Если бы каждый экран считал следующий шаг
 * сам, любой забытый экран уводил бы человека на второй круг воронки. Здесь
 * это решается один раз для всех.
 */
export function useNav(): {
  step: StepKey;
  next: () => void;
  goTo: (step: StepKey) => void;
  /** Идёт ли человек сейчас по пересмотру после провала теста. */
  reviewing: boolean;
} {
  const step = useFunnel((s) => s.step);
  const goTo = useFunnel((s) => s.goTo);
  const returnTo = useFunnel((s) => s.returnTo);
  const restartQuiz = useFunnel((s) => s.restartQuiz);

  const reviewing = returnTo === 'test';

  return {
    step,
    goTo,
    reviewing,
    next: () => {
      if (reviewing) {
        // Пересмотр окончен: проверка начинается заново, с полными жизнями.
        restartQuiz();
        return;
      }
      const n = nextStep(step);
      if (n) goTo(n);
    },
  };
}
