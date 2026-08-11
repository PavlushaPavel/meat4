import { motion, useReducedMotion } from 'motion/react';
import { calm, dur, spring, stagger, tween } from '@/scene/motion';
import { cn } from '@/lib/cn';

/**
 * Входящее уведомление от клиента.
 *
 * ЧТО ЗДЕСЬ ПРОИСХОДИТ ФИЗИЧЕСКИ. Карточка выезжает снизу пружиной с лёгким
 * перелётом, а в момент приземления её коротко трясёт — так выглядит телефон,
 * который лежал спокойно и вдруг завибрировал. Тряска сделана смещением по X с
 * затуханием, а не вращением: вращающееся уведомление читается как игрушка.
 *
 * Внутри сначала бегут три точки «печатает», и только потом появляется текст.
 * Пауза здесь работает как в жизни: ты видишь, что человек пишет, и уже
 * напрягся ещё до того, как прочитал.
 *
 * ДОСТУПНОСТЬ. При системной настройке «меньше движения» карточка просто
 * появляется без выезда и тряски — но порядок сохраняется: сначала «печатает»,
 * потом текст. Событие никуда не девается, исчезает только его физика.
 *
 * Вибрация телефона живёт не здесь, а на экране (`vibrate()` в lib/telegram.ts):
 * этот компонент отвечает за то, что видно, и не должен решать, когда трясти
 * устройство.
 */
export function IncomingMessage({
  sender,
  typing,
  text,
  /** `false` — ещё идут точки, `true` — текст пришёл. */
  delivered,
  className,
}: {
  sender: string;
  typing: string;
  text: string;
  delivered: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 34, scale: 0.96 }}
      animate={
        reduceMotion
          ? { opacity: 1 }
          : {
              opacity: 1,
              y: 0,
              scale: 1,
              // Тряска приземления: четыре затухающих толчка вбок.
              x: [0, -7, 6, -4, 2, 0],
            }
      }
      transition={calm(reduceMotion, {
        y: spring.land,
        scale: spring.land,
        opacity: tween(dur.press),
        // Тряска ждёт приземления и гаснет сама: у затухающих толчков своё
        // мягкое торможение, а не общая кривая появления.
        x: { delay: 0.1, duration: dur.base, ease: 'easeOut' as const },
      })}
      className={cn(
        // Это уведомление ОС, а не элемент мира: своя тёмная плашка мессенджера,
        // без неона, металла и жёлтой ленты.
        'flex items-start gap-3 rounded-2xl border border-white/10 bg-tg-in/95 p-3.5 shadow-[0_18px_40px_-16px_#000] backdrop-blur-sm',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-tg-out font-display text-base font-semibold text-tg-ink"
      >
        К
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold text-tg-ink">{sender}</p>

        {delivered ? (
          <p className="mt-0.5 line-clamp-2 text-small leading-snug text-tg-ink/80">{text}</p>
        ) : (
          <TypingDots label={typing} reduceMotion={Boolean(reduceMotion)} />
        )}
      </div>
    </motion.div>
  );
}

/**
 * Три бегущие точки. Подпись рядом остаётся текстом — точки декоративны, и
 * человек, который их не видит, обязан прочитать «печатает…» словами.
 */
function TypingDots({ label, reduceMotion }: { label: string; reduceMotion: boolean }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-small text-tg-dim">
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-tg-dim"
            animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 1, repeat: Infinity, delay: i * stagger.reveal, ease: 'easeInOut' }
            }
          />
        ))}
      </span>
      {label}
    </p>
  );
}
