import type { ExternalAction } from '@/content/types';
import { externalUrl } from '@/lib/env';
import { openLink } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics';

/**
 * Кнопка на внешний ресурс: ассистент, оплата, поддержка.
 *
 * ЧЕСТНОЕ СОСТОЯНИЕ ОБЯЗАТЕЛЬНО. Пока переменная сборки пуста, кнопка не
 * исчезает и не ведёт в никуда — она становится неактивной с подписью, почему
 * (docs/SPEC.md §3.7). Молча подсунуть мёртвую ссылку хуже, чем сказать, что
 * ссылки пока нет: воронка выкладывается до того, как появятся оплата и
 * ассистенты, и это её нормальное состояние.
 */
export function ExternalButton({
  action,
  className,
}: {
  action: ExternalAction;
  className?: string;
}) {
  const url = externalUrl(action.envVar);

  if (!url) {
    return (
      <div
        className={cn(
          'flex min-h-14 w-full min-w-0 flex-col items-start justify-center gap-1.5 rounded-plate border border-dashed border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
          className,
        )}
      >
        <span className="min-w-0 max-w-full break-words font-display text-lg font-semibold uppercase tracking-wide text-ink-dim/60">
          {action.label}
        </span>
        {action.pending && (
          <span className="legend min-w-0 max-w-full break-words text-ink-dim/70">
            {action.pending}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        track('external', { target: action.envVar });
        openLink(url);
      }}
      className={cn(
        'flex min-h-14 w-full items-center justify-between gap-3 rounded-plate bg-hazard px-5 py-3 font-display text-lg font-semibold uppercase tracking-wide text-on-hazard shadow-[0_3px_0_var(--color-hazard-deep)] transition-transform duration-150 active:translate-y-px',
        className,
      )}
    >
      <span className="flex-1 text-left">{action.label}</span>
      <span aria-hidden="true" className="shrink-0 text-xl leading-none">
        ↗
      </span>
    </button>
  );
}
