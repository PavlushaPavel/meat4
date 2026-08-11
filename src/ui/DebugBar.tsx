import { STEPS, stepIndex } from '@/router/flow';
import { useFunnel } from '@/store/funnel';

/**
 * Панель отладки: сброс воронки в начало.
 *
 * ВКЛЮЧАЕТСЯ ТОЛЬКО ФЛАГОМ В АДРЕСЕ — `?debug`. Живой человек её не увидит
 * никогда, и для этого не нужна пересборка: флаг можно дописать прямо к
 * боевому адресу, проверить и убрать.
 *
 * ПОЧЕМУ ПОЛОСА В ПОТОКЕ, А НЕ ПЛАВАЮЩАЯ КНОПКА. Кнопка поверх экрана
 * обязательно на что-нибудь ляжет: снизу во всю ширину стоит главное действие,
 * сверху справа на экранах карты — счётчик открытых зон. Полоса занимает
 * собственную высоту в потоке документа, поэтому перекрыть контент физически не
 * может, а `sticky` держит её в кадре при прокрутке.
 *
 * Заодно показывает текущий шаг и собранные детали связки: при отладке важнее
 * всего знать, где ты находишься и что уже успел получить.
 */
export function DebugBar() {
  const step = useFunnel((s) => s.step);
  const artifacts = useFunnel((s) => s.artifacts);
  const reset = useFunnel((s) => s.reset);

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-alarm/40 bg-alarm/15 px-4 py-2 backdrop-blur-sm">
      <span className="legend shrink-0 text-alarm">ОТЛАДКА</span>

      <span className="legend min-w-0 flex-1 truncate text-ink-dim">
        {stepIndex(step) + 1}/{STEPS.length} · {step}
        {artifacts.length > 0 ? ` · ${artifacts.join(' ')}` : ''}
      </span>

      <button
        type="button"
        onClick={reset}
        className="legend shrink-0 rounded-plate border border-alarm/60 px-2.5 py-1 text-alarm transition-colors duration-150 hover:bg-alarm/20"
      >
        Начать сначала
      </button>
    </div>
  );
}
