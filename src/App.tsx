import { useEffect, useState } from 'react';
import { SCREENS } from '@/router/registry';
import { actOfStep } from '@/router/flow';
import { useFunnel } from '@/store/funnel';
import { initTelegram } from '@/lib/telegram';
import { track } from '@/lib/analytics';
import { stepIndex } from '@/router/flow';
import { CityStage } from '@/ui/CityStage';
import { DebugBar } from '@/ui/DebugBar';
import { isDebugEnabled } from '@/lib/debug';

/**
 * Оболочка воронки.
 *
 * Здесь ровно три обязанности и ни одной строки копирайта:
 *  1. поднять Telegram Mini App;
 *  2. объявить акт — от него зависит вся палитра сцены (tokens.css);
 *  3. показать экран текущего шага.
 *
 * ПРОГРЕССА В ШАПКЕ НЕТ, и это решение, а не пропуск. Прогресс здесь — сама
 * связка: участок встаёт на место и загорается. Общий индикатор поверх воронки
 * отбирал бы у неё ровно тот смысл, ради которого всё построено, и заодно врал
 * бы про длину — шаги неравные, минутная сцена и двадцатиминутная глава стоят
 * в маршруте рядом (docs/SPEC.md §1.3, §2).
 *
 * Полоса `1. Аудитория → 2. Оффер → 3. Посадка` внутри акта обучения этому не
 * противоречит: это оглавление курса, а не индикатор мира, и живёт оно на
 * страницах глав, а не в оболочке.
 */
export default function App() {
  const step = useFunnel((s) => s.step);
  const Screen = SCREENS[step];
  const act = actOfStep(step);
  // Читается один раз за загрузку: флаг не меняется по ходу сессии.
  const [debug] = useState(isDebugEnabled);

  useEffect(() => {
    initTelegram();
  }, []);

  // Новый шаг — новый экран: прокрутка возвращается наверх. Без этого человек
  // приезжает на следующий экран в середину текста. Прокручивается документ,
  // а не контейнер: своей области прокрутки у оболочки нет.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Каждый показ экрана — событие. Из них и собирается воронка отвала.
  //
  // Шагов теперь восемь, а не тридцать один, и это меняет смысл измерения:
  // отвал внутри одного шага (человек ушёл на третьем такте префрейма или на
  // седьмом вопросе проверки) отсюда не виден. Такие события шлют сами экраны.
  useEffect(() => {
    track('step', { step, index: stepIndex(step) + 1 });
  }, [step]);

  return (
    <>
      {/*
        Панель отладки живёт НАД сценой и в потоке документа: так она не может
        перекрыть ни главное действие внизу, ни счётчик зон на карте. Без
        `?debug` в адресе её нет в разметке вообще.
      */}
      {debug && <DebugBar />}
      <CityStage act={act} step={step}>
        <Screen />
      </CityStage>
    </>
  );
}
