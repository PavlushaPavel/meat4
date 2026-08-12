/**
 * Единственная точка чтения переменных сборки `VITE_*`.
 *
 * Пустая или неопределённая переменная приводится к `''`. Компоненты сами
 * решают, как честно показать отсутствие значения: слот видео говорит
 * «материал пока не подключён», кнопка на внешний ресурс становится неактивной
 * с подписью. Молча вести в никуда нельзя (docs/SPEC.md §3.7).
 *
 * Воронка обязана проходиться до конца при полностью пустом окружении — это
 * текущее состояние проекта, а не крайний случай: видео ещё не сняты, ссылки
 * на ассистентов и оплату появятся позже.
 */
function readEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export const env = {
  video: {
    VITE_VIDEO_1_URL: readEnv(import.meta.env.VITE_VIDEO_1_URL),
    VITE_VIDEO_2_URL: readEnv(import.meta.env.VITE_VIDEO_2_URL),
    VITE_VIDEO_3_URL: readEnv(import.meta.env.VITE_VIDEO_3_URL),
  },
  /**
   * Голосовое вступление автора. Пусто — воронка начинается тем же нажатием,
   * но дальше идёт текстом по таймеру: пузырь честно говорит, что записи нет.
   */
  VITE_VOICE_INTRO_URL: readEnv(import.meta.env.VITE_VOICE_INTRO_URL),
  VITE_ASSISTANT_AUDIENCE_URL: readEnv(import.meta.env.VITE_ASSISTANT_AUDIENCE_URL),
  VITE_ASSISTANT_OFFER_URL: readEnv(import.meta.env.VITE_ASSISTANT_OFFER_URL),
  VITE_ANALYTICS_URL: readEnv(import.meta.env.VITE_ANALYTICS_URL),
  VITE_LANDING_DEMO_URL: readEnv(import.meta.env.VITE_LANDING_DEMO_URL),
  VITE_CHECKOUT_URL: readEnv(import.meta.env.VITE_CHECKOUT_URL),
  VITE_SUPPORT_URL: readEnv(import.meta.env.VITE_SUPPORT_URL),
} as const;

/** Ключи слотов видео — совпадают с `LessonContent['envVar']` по построению. */
export type VideoEnvVar = keyof typeof env.video;

/** Ключи внешних ссылок — совпадают с `ExternalAction['envVar']`. */
export type ExternalEnvVar =
  | 'VITE_ASSISTANT_AUDIENCE_URL'
  | 'VITE_ASSISTANT_OFFER_URL'
  | 'VITE_LANDING_DEMO_URL'
  | 'VITE_CHECKOUT_URL'
  | 'VITE_SUPPORT_URL';

/** Адрес внешнего ресурса или пустая строка, если он ещё не задан. */
export function externalUrl(key: ExternalEnvVar): string {
  return env[key];
}
