import { STEPS, nextStep, prevStep, stepIndex, type StepKey } from '@/router/flow';
import { useFunnel } from '@/store/funnel';

/**
 * Панель отладки: где я в воронке, как прыгнуть куда угодно, как начать заново.
 *
 * ВКЛЮЧАЕТСЯ ТОЛЬКО ФЛАГОМ В АДРЕСЕ — `?debug`. Живой человек её не увидит
 * никогда, и для этого не нужна пересборка: флаг дописывается прямо к боевому
 * адресу, проверяется и убирается.
 *
 * ПОЧЕМУ ПОЛОСА ПОВЕРХ, А НЕ В ПОТОКЕ. Раньше она занимала собственную высоту,
 * и это было верно, пока экраны росли вниз. С 12.08.2026 сцены имеют высоту
 * ровно в экран — и полоса в потоке добавляла к ним свои 87 пикселей: страница
 * начинала прокручиваться, нижняя реплика и полоса речи уезжали за край.
 *
 * То есть инструмент отладки ЛОМАЛ ту самую раскладку, которую показывал, и
 * отличить его вклад от настоящей поломки было невозможно. Хуже такого
 * инструмента только его отсутствие. Теперь полоса лежит поверх и высоты не
 * занимает: она перекрывает верхний край кадра, и это честная цена.
 *
 * ЗАЧЕМ ПРЫЖОК ПО ШАГАМ. Воронка проходится за двадцать с лишним минут, из
 * которых половина — сцены, идущие в своём темпе. Смотреть финал, каждый раз
 * проходя восемь шагов, невозможно; без прыжка отладка сводится к «начать
 * сначала», то есть к самому долгому пути.
 *
 * Прыжок НЕ подставляет состояние руками — ни собранных деталей, ни пройденной
 * проверки. Экраны досыпают своё сами при монтировании (деталь встаёт на место,
 * дверь открывается), а всё остальное честно остаётся пустым: отладка обязана
 * показывать то же, что увидит человек, придя на этот шаг, а не приукрашенную
 * версию.
 *
 * КОПИРАЙТА ЗДЕСЬ НЕТ, хотя строки в компоненте есть. Правило «весь текст в
 * `src/content/*`» касается того, что читает человек воронки; эти подписи он не
 * увидит никогда, и держать их в контенте значило бы смешивать продукт с
 * инструментом.
 */
export function DebugBar() {
  const step = useFunnel((s) => s.step);
  const artifacts = useFunnel((s) => s.artifacts);
  const passed = useFunnel((s) => s.passed);
  const goTo = useFunnel((s) => s.goTo);
  const reset = useFunnel((s) => s.reset);

  const back = prevStep(step);
  const forward = nextStep(step);

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-w-screen-sm flex-col gap-1.5 border-b border-alarm/40 bg-alarm/25 px-4 py-2 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="legend shrink-0 text-alarm">ОТЛАДКА</span>

        <span className="legend min-w-0 flex-1 truncate text-ink-dim">
          {stepIndex(step) + 1}/{STEPS.length}
          {artifacts.length > 0 ? ` · ${artifacts.join(' ')}` : ''}
          {passed ? ' · тест сдан' : ''}
        </span>

        <button
          type="button"
          onClick={reset}
          className="legend min-h-8 shrink-0 rounded-plate border border-alarm/60 px-2.5 py-1 text-alarm transition-colors duration-150 hover:bg-alarm/20"
        >
          Начать сначала
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Step onClick={() => back && goTo(back)} disabled={!back} label="◀" />

        {/*
          Родной `select`, а не своё меню: в вебвью Telegram он открывается
          системным списком, попадает под палец без вёрстки и работает с
          клавиатуры. Для инструмента это ровно то, что нужно.
        */}
        <select
          value={step}
          onChange={(e) => goTo(e.target.value as StepKey)}
          aria-label="Шаг воронки"
          className="legend min-h-8 min-w-0 flex-1 rounded-plate border border-alarm/60 bg-scene px-2 py-1 text-ink"
        >
          {STEPS.map((s, i) => (
            <option key={s} value={s}>
              {i + 1}. {s}
            </option>
          ))}
        </select>

        <Step onClick={() => forward && goTo(forward)} disabled={!forward} label="▶" />
      </div>
    </div>
  );
}

/** Шаг назад или вперёд. На краях маршрута гаснет, а не исчезает. */
function Step({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="legend min-h-8 shrink-0 rounded-plate border border-alarm/60 px-3 py-1 text-alarm transition-colors duration-150 hover:bg-alarm/20 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}
