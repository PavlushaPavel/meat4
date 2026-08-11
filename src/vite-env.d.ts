/// <reference types="vite/client" />

/**
 * Переменные сборки.
 *
 * ЭТОТ ФАЙЛ ОБЯЗАН СОВПАДАТЬ С `.env.example` И `env.ts`. До 11.08.2026 он
 * объявлял `VITE_VIDEO_1A_URL` и `VITE_VIDEO_1B_URL` — слоты воронки, в которой
 * первое видео было разрезано интерактивной паузой. Тех переменных не
 * существовало уже давно, а настоящие `VITE_VIDEO_1_URL`, `VITE_ANALYTICS_URL`
 * и `VITE_LANDING_DEMO_URL` здесь не значились вовсе.
 *
 * Молчало это потому, что `vite/client` объявляет `ImportMetaEnv` с индексной
 * сигнатурой: любое имя проходит типизацию. То есть опечатка в имени переменной
 * не ломает сборку — она просто отдаёт `undefined`, экран показывает честную
 * заглушку, и выглядит это как «ссылку ещё не завели», а не как ошибка.
 * Поэтому список ведётся руками и держится в одном порядке с `.env.example`.
 */
interface ImportMetaEnv {
  /** Три главы обучения. Пока не сняты — пустое значение штатно. */
  readonly VITE_VIDEO_1_URL: string | undefined;
  readonly VITE_VIDEO_2_URL: string | undefined;
  readonly VITE_VIDEO_3_URL: string | undefined;

  /** Ассистенты, которых автор показывает внутри глав. */
  readonly VITE_ASSISTANT_AUDIENCE_URL: string | undefined;
  readonly VITE_ASSISTANT_OFFER_URL: string | undefined;

  /** Куда мини-апп шлёт события прохождения. Пусто = аналитика выключена. */
  readonly VITE_ANALYTICS_URL: string | undefined;

  /** Сайт, собранный в третьей главе: главное доказательство воронки. */
  readonly VITE_LANDING_DEMO_URL: string | undefined;

  /** Оплата TRAFFIC LAB и поддержка. */
  readonly VITE_CHECKOUT_URL: string | undefined;
  readonly VITE_SUPPORT_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
