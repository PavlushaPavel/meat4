/**
 * Единственный файл, который трогает window.Telegram.
 * Вне Telegram (обычный браузер) — безопасные no-op заглушки, никогда не бросает.
 */

// Граница с внешним SDK — единственное разрешённое место для `any` (ARCHITECTURE.md §11).
type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  initDataUnsafe?: {
    user?: { id?: number; first_name?: string; username?: string };
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'success' | 'error' | 'warning') => void;
    selectionChanged: () => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function getWebApp(): TelegramWebApp | null {
  try {
    return window.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export const isTelegram: boolean = getWebApp() !== null;

export interface Haptics {
  light(): void;
  medium(): void;
  heavy(): void;
  success(): void;
  error(): void;
  warning(): void;
  select(): void;
}

function safeHaptic(fn: (h: NonNullable<TelegramWebApp['HapticFeedback']>) => void): void {
  try {
    const wa = getWebApp();
    if (wa?.HapticFeedback) fn(wa.HapticFeedback);
  } catch {
    // no-op вне Telegram
  }
}

export const haptics: Haptics = {
  light: () => safeHaptic((h) => h.impactOccurred('light')),
  medium: () => safeHaptic((h) => h.impactOccurred('medium')),
  heavy: () => safeHaptic((h) => h.impactOccurred('heavy')),
  success: () => safeHaptic((h) => h.notificationOccurred('success')),
  error: () => safeHaptic((h) => h.notificationOccurred('error')),
  warning: () => safeHaptic((h) => h.notificationOccurred('warning')),
  select: () => safeHaptic((h) => h.selectionChanged()),
};

/**
 * ФИЗИЧЕСКАЯ ВИБРАЦИЯ ТЕЛЕФОНА.
 *
 * Два разных механизма, и оба нужны:
 *  · внутри Telegram работает `HapticFeedback` — он единственный, что вообще
 *    доступно в мини-аппе на iOS;
 *  · в обычном браузере Telegram-API нет, зато на Android есть
 *    `navigator.vibrate`, который берёт узор из пауз и импульсов.
 *
 * ЧЕСТНО ПРО iOS: вне Telegram Safari `navigator.vibrate` не поддерживает
 * вообще, и обойти это нельзя. Значит, вибрация — усиление момента, а не
 * носитель смысла: экран обязан читаться и без неё.
 *
 * @param pattern узор для `navigator.vibrate`, мс: импульс, пауза, импульс…
 */
export function vibrate(pattern: number | number[]): void {
  // Внутри Telegram: настоящий системный отклик.
  safeHaptic((h) => h.impactOccurred('heavy'));

  // Вне Telegram: Web Vibration API, если он есть и разрешён.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Браузер может запретить вибрацию без жеста пользователя — это не ошибка.
  }
}

/**
 * Инициализация Mini App: раскрыть, сообщить о готовности, зафиксировать фирменные цвета.
 * Тема принудительно тёмная, тема клиента игнорируется намеренно (docs/SPEC.md §1).
 * Telegram WebApp принимает только конкретный hex, а не CSS-переменную — цвет читается
 * прямо из --garden-ground (tokens.css), чтобы не заводить второй хардкод того же значения.
 */
export function initTelegram(): void {
  try {
    const wa = getWebApp();
    if (!wa) return;
    wa.ready();
    wa.expand();
    wa.disableVerticalSwipes?.();
    // Цвет шапки и фона клиента = фон сцены. Telegram принимает только
    // конкретный hex, а не CSS-переменную, поэтому значение читается прямо из
    // токенов (src/styles/tokens.css) — иначе тот же цвет пришлось бы держать
    // вторым хардкодом и однажды разъехаться с миром.
    //
    // ИМЯ ТОКЕНА МЕНЯЛОСЬ. До 08.08.2026 здесь стоял `--garden-ground` из мира
    // «Сад обратной гравитации»; он пережил ещё одну смену мира незамеченным,
    // потому что пустое значение молча пропускается веткой `if (canvas)` —
    // шапка просто оставалась чужого цвета, и никто этого не видел.
    const canvas = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-scene')
      .trim();
    if (canvas) {
      wa.setHeaderColor(canvas);
      wa.setBackgroundColor(canvas);
    }
  } catch {
    // no-op вне Telegram
  }
}

let currentBackHandler: (() => void) | null = null;

/** Показать/скрыть системную кнопку "назад" и привязать обработчик. */
export function setBackButton(visible: boolean, onClick?: () => void): void {
  try {
    const wa = getWebApp();
    if (!wa) return;
    if (currentBackHandler) {
      wa.BackButton.offClick(currentBackHandler);
      currentBackHandler = null;
    }
    if (visible) {
      if (onClick) {
        currentBackHandler = onClick;
        wa.BackButton.onClick(onClick);
      }
      wa.BackButton.show();
    } else {
      wa.BackButton.hide();
    }
  } catch {
    // no-op вне Telegram
  }
}

/** Открыть ссылку: t.me — через openTelegramLink, остальное — через openLink. */
export function openLink(url: string): void {
  try {
    const wa = getWebApp();
    if (!wa) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const isTelegramDomain = /^https?:\/\/(t|telegram)\.me\//i.test(url);
    if (isTelegramDomain) {
      wa.openTelegramLink(url);
    } else {
      wa.openLink(url);
    }
  } catch {
    // no-op
  }
}

export function closeApp(): void {
  try {
    getWebApp()?.close();
  } catch {
    // no-op вне Telegram
  }
}

export function getUser(): { id?: number; firstName?: string; username?: string } | null {
  try {
    const user = getWebApp()?.initDataUnsafe?.user;
    if (!user) return null;
    return { id: user.id, firstName: user.first_name, username: user.username };
  } catch {
    return null;
  }
}
