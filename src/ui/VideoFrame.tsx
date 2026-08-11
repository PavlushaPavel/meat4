import { motion, useReducedMotion } from 'motion/react';
import { calm } from '@/scene/motion';
import { env, type VideoEnvVar } from '@/lib/env';
import { cn } from '@/lib/cn';

/**
 * Плеер главы.
 *
 * ГЛАВНОЕ ПРО ЭТОТ КОМПОНЕНТ: записей не существует ни одной, и это НОРМАЛЬНОЕ
 * состояние проекта, а не заглушка на будущее. Воронка выложена людям с пустым
 * окружением, поэтому пустой слот обязан быть честным и не мешать идти дальше
 * (docs/SPEC.md §3.7): развёртка неподключённого монитора, подпись, что
 * материала пока нет, и кнопка «дальше» при этом активна.
 *
 * Геометрия одинаковая в обоих состояниях — 16:9. Появление записи не должно
 * сдвинуть ни одной строки конспекта под плеером.
 */
export function VideoFrame({
  envVar,
  title,
  pending,
  pendingHint,
  startAt = null,
  className,
}: {
  envVar: VideoEnvVar;
  /** Имя записи для скринридера и для рамки. Копирайт приходит из контента. */
  title: string;
  /** Что написано, пока записи нет. */
  pending: string;
  /** Строка помельче: почему это не поломка и что делать дальше. */
  pendingHint: string;
  /**
   * Секунда, с которой начать. Нужна пересмотру после провала проверки: ошибка
   * знает свой момент в записи (`QuizQuestion.reviewAt`), и человека надо
   * вернуть туда, а не в начало двадцатиминутной главы. Пока таймкодов нет,
   * сюда приходит `null` — но путь до плеера уже проложен, чтобы в день
   * появления записей не пришлось переписывать три экрана.
   */
  startAt?: number | null;
  className?: string;
}) {
  const url = env.video[envVar];
  const reduceMotion = useReducedMotion();

  // Ширина НЕ задаётся утилитой: блок и так занимает всю колонку, а экран
  // главы выводит плеер за поля отрицательными полями (`-mx-5`). Если написать
  // здесь `w-full`, ширина зафиксируется по колонке и полный вылет за поля
  // превратится в сдвиг картинки влево.
  const frame = 'relative aspect-video overflow-hidden bg-scene-deep';

  if (!url) {
    return (
      <div className={cn(frame, className)}>
        {/*
          Развёртка неподключённого монитора. Процедурный CSS, без картинок:
          растровый «нет сигнала» пришлось бы грузить ради состояния, которое
          обязано появляться мгновенно и на любом экране.

          Три слоя: строчная развёртка, косой муар и провал яркости к краям.
          Ни один не должен спорить с подписью — она здесь главное.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `repeating-linear-gradient(
                0deg,
                color-mix(in oklab, var(--color-ink) 7%, transparent) 0 1px,
                transparent 1px 4px
              ),
              repeating-linear-gradient(
                58deg,
                color-mix(in oklab, var(--color-ink) 4%, transparent) 0 1px,
                transparent 1px 9px
              )`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(
              110% 75% at 50% 45%,
              transparent 0%,
              transparent 46%,
              color-mix(in oklab, var(--color-scene-deep) 78%, transparent) 100%
            )`,
          }}
        />

        {/*
          Одна медленная полоса поперёк развёртки — единственное движение на
          всём экране обучения. Она говорит «монитор включён, сигнала нет».
          При `prefers-reduced-motion` полоса не бегает, а стоит: убрать её
          совсем нельзя, иначе состояние потеряет часть смысла.

          ЕДЕТ `translateY`, А НЕ `top`. Это самое долгое движение во всём
          продукте: экран главы человек держит открытым двадцать минут, и
          анимация раскладочного свойства всё это время заставляла бы браузер
          пересчитывать геометрию и перерисовывать кадр непрерывно. Трансформа
          раскладку не трогает и уходит на композитор.

          ОТСЮДА ДВА ЭЛЕМЕНТА ВМЕСТО ОДНОГО, и это не украшение: проценты в
          `translateY` считаются от СОБСТВЕННОЙ высоты элемента, а прежние
          проценты в `top` — от высоты кадра. Поэтому едет носитель во весь
          кадр (`inset-0`), а полоса в 4rem сидит внутри него сверху: её
          верхний край проходит те же -18% → 104% высоты кадра, что и раньше.
        */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ y: '-18%' }}
          animate={reduceMotion ? { y: '42%' } : { y: ['-18%', '104%'] }}
          transition={calm(reduceMotion, {
            duration: 7.5,
            // `as const` обязателен: `calm` — обобщённая функция, и без него
            // кривая уезжает в тип `string`, которого motion не принимает.
            ease: 'linear' as const,
            repeat: Infinity,
          })}
        >
          <div
            className="h-16 w-full"
            style={{
              background: `linear-gradient(
                180deg,
                transparent,
                color-mix(in oklab, var(--color-ink) 6%, transparent),
                transparent
              )`,
            }}
          />
        </motion.div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-display text-lead uppercase leading-tight tracking-wide text-ink-dim">
            {pending}
          </p>
          <p className="max-w-[34ch] text-small leading-relaxed text-ink-dim/80">
            {pendingHint}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(frame, className)}>
      <iframe
        src={withStart(url, startAt)}
        title={title}
        className="absolute inset-0 size-full border-0"
        loading="lazy"
        // Разрешаем ровно то, без чего не работает ни один плеер, и ничего
        // сверх: доступа к камере, микрофону и геолокации у записи нет.
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        // Реферер уходит только доменом — хостингу видео незачем знать адрес
        // конкретного экрана мини-аппа.
        referrerPolicy="strict-origin-when-cross-origin"
        // `sandbox` сознательно НЕ ставим: он ломает все распространённые
        // плееры, а адрес сюда приходит из переменной сборки, которую задаём
        // мы сами, а не из пользовательского ввода.
      />
    </div>
  );
}

/**
 * Приписать к адресу момент старта.
 *
 * Форматов два, и мы отдаём оба: `?start=` понимают встраиваемые плееры
 * YouTube и Rutube, `#t=` — VK и обычный `<video>`. Лишний параметр плеер
 * игнорирует, поэтому дешевле отдать оба, чем угадывать хостинг до того, как
 * записи вообще сняты.
 *
 * Разбираем строкой, а не конструктором `URL`: в переменной сборки может
 * лежать относительный путь, на котором `URL` бросит исключение и уронит
 * экран целиком.
 */
function withStart(url: string, seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return url;

  const at = Math.floor(seconds);
  // Собственный фрагмент адреса отбрасываем: во встраиваемых плеерах он и есть
  // таймкод, а два таймкода в одной ссылке — это ссылка неизвестно куда.
  const base = url.split('#')[0];
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}start=${at}#t=${at}`;
}
