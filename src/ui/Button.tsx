import type { ReactNode } from 'react';
import { haptics } from '@/lib/telegram';
import { cn } from '@/lib/cn';

type Variant = 'hazard' | 'ghost' | 'neon';

/**
 * Действие.
 *
 * `hazard` — главное действие экрана: жёлтая плашка промзоны со стрелкой.
 *            На экране оно ровно одно (docs/SPEC.md §5.3).
 * `ghost`  — второстепенное: пропустить, пересмотреть, вернуться.
 * `neon`   — действие открытого маршрута: только там, где зона уже открыта.
 *
 * Высота 56px — палец, а не курсор. Ниже опускаться нельзя.
 *
 * ТАКТИЛЬНЫЙ ОТКЛИК ЖИВЁТ ЗДЕСЬ, А НЕ НА ЭКРАНАХ. Иначе он неизбежно
 * разъедется: часть кнопок отзывалась бы, часть нет, и телефон начал бы врать
 * про то, что в приложении важно. Сила отклика привязана к роли кнопки, а не к
 * экрану: главное действие ощущается заметнее второстепенного — ровно так же,
 * как оно выглядит.
 *
 * Вне Telegram вызов молча ничего не делает: вибрация усиливает момент, но
 * никогда не несёт смысл сама (`src/lib/telegram.ts`).
 */
export function Button({
  children,
  onClick,
  variant = 'hazard',
  disabled = false,
  arrow = true,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Стрелка справа. Убирается там, где действие не ведёт вперёд по маршруту. */
  arrow?: boolean;
  className?: string;
}) {
  const base =
    'relative flex min-h-14 w-full items-center justify-between gap-3 rounded-plate px-5 py-3 text-left font-display text-lg font-semibold uppercase tracking-wide transition-transform duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0';

  const skin: Record<Variant, string> = {
    hazard:
      'bg-hazard text-on-hazard shadow-[0_3px_0_var(--color-hazard-deep),0_10px_24px_-12px_#000]',
    ghost: 'border border-line bg-transparent text-ink-dim hover:text-ink',
    neon: 'neon-edge bg-transparent text-neon',
  };

  // Главное действие — средний импульс, второстепенные — лёгкий. Неоновая
  // кнопка ведёт по открытому маршруту, это тоже шаг вперёд, а не служебный жест.
  const feel: Record<Variant, () => void> = {
    hazard: haptics.medium,
    ghost: haptics.light,
    neon: haptics.medium,
  };

  return (
    <button
      type="button"
      onClick={
        onClick &&
        (() => {
          feel[variant]();
          onClick();
        })
      }
      disabled={disabled}
      className={cn(base, skin[variant], className)}
    >
      <span className="flex-1">{children}</span>
      {arrow && (
        <span aria-hidden="true" className="shrink-0 text-xl leading-none">
          →
        </span>
      )}
    </button>
  );
}
