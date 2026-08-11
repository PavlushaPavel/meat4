import type { ReactElement } from 'react';
import type { StepKey } from './flow';

import { PreframeScreen } from '@/features/preframe/PreframeScreen';
import { ConversionScreen } from '@/features/preframe/ConversionScreen';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { AudienceScreen } from '@/features/city/AudienceScreen';
import { TestScreen } from '@/features/test/TestScreen';
import { BundleScreen } from '@/features/bundle/BundleScreen';
import { LESSONS } from '@/content/lessons';

/**
 * Какой экран показывается на каждом шаге маршрута (docs/SPEC.md §2).
 *
 * Только сопоставление шага и экрана: сами экраны живут в `src/features/*`,
 * копирайт — в `src/content/*`. Здесь нет ни того, ни другого.
 *
 * Тип `Record<StepKey, …>` обязателен: он не даст добавить шаг в `STEPS` и
 * забыть про экран — сборка упадёт на этом файле, а не в браузере.
 *
 * ТРИ ГЛАВЫ — ОДИН ЭКРАН С РАЗНЫМ СОДЕРЖИМЫМ. Это не экономия, а требование
 * канона: страница обучения обязана выглядеть одинаково во всех трёх главах,
 * иначе полоса «1. Аудитория → 2. Оффер → 3. Посадка» перестаёт означать
 * движение по одному и тому же курсу.
 */
export const SCREENS: Record<StepKey, () => ReactElement> = {
  // Акт I. Город.
  preframe: () => <PreframeScreen />,
  conversion: () => <ConversionScreen />,

  // Акт II. Обучение.
  video1: () => <LessonScreen content={LESSONS.video1} />,

  // Акт I. Город: пятнадцать секунд награды между главами.
  audience: () => <AudienceScreen />,

  video2: () => <LessonScreen content={LESSONS.video2} />,

  // Акт III. Лаборатория: закрытая дверь и проверка.
  test: () => <TestScreen />,

  video3: () => <LessonScreen content={LESSONS.video3} />,

  bundle: () => <BundleScreen />,
};
