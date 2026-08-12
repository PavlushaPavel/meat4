import { motion, useReducedMotion } from 'motion/react';
import { introAsset } from '@/ui/assets';
import { cn } from '@/lib/cn';

/**
 * Город, который живёт сам по себе.
 *
 * ЗАЧЕМ ЭТО НУЖНО ИМЕННО НА ПЕРВОМ ЭКРАНЕ. Пока человек не нажал
 * воспроизведение, на экране не должно быть ни мёртвой картинки, ни
 * происходящего сюжета: первое читается как заставка, второе крадёт у голоса
 * его работу. Нужен именно фон, который дышит, — тогда экран воспринимается как
 * место, в котором уже находишься, а не как обложка перед входом.
 *
 * ДВИЖЕНИЕ НАМЕРЕННО ПОЧТИ НЕЗАМЕТНОЕ. Медленный наезд на процент с небольшим,
 * редкие огни вдоль трасс и тёплое подрагивание окон. Каждое по отдельности не
 * ловится глазом; вместе они дают ощущение, что город работает своей жизнью,
 * пока ты решаешь, слушать или нет.
 *
 * При `prefers-reduced-motion` остаётся неподвижный кадр: это фон, и потерять
 * с ним нечего.
 */
export function LivingCity({
  file = 'city-1.webp',
  className,
}: {
  /** Какой кадр города оживает. Все три лежат в `public/intro/`. */
  file?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/*
        Наезд длиной в минуту с лишним и без возврата: город медленно
        приближается всё время, пока человек здесь. Цикл с откатом читался бы
        как дыхание заставки, а не как движение камеры.
      */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${introAsset(file)}")` }}
        initial={reduceMotion ? false : { scale: 1.04 }}
        animate={reduceMotion ? undefined : { scale: 1.12 }}
        transition={{ duration: 90, ease: 'linear' }}
      />

      {/* Тёплые окна: очень медленное общее подрагивание света в кадре. */}
      {!reduceMotion && (
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_72%,rgba(239,191,19,0.10),transparent_62%)]"
          animate={{ opacity: [0.55, 0.9, 0.6, 0.85, 0.55] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/*
        Огни на трассах. Три полосы разной длины и скорости идут поперёк кадра —
        этого хватает, чтобы город читался как работающий. Больше полос
        превратили бы фон в анимацию, за которой начинают следить.
      */}
      {!reduceMotion &&
        TRAFFIC.map((lane) => (
          <motion.span
            key={lane.top}
            className="absolute h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
            style={{ top: lane.top, width: lane.width }}
            initial={{ left: '-30%', opacity: 0 }}
            animate={{ left: ['-30%', '115%'], opacity: [0, 0.8, 0] }}
            transition={{
              duration: lane.duration,
              repeat: Infinity,
              delay: lane.delay,
              ease: 'linear',
            }}
          />
        ))}
    </div>
  );
}

/** Полосы движения: положение, длина, скорость и сдвиг по фазе. */
const TRAFFIC = [
  { top: '58%', width: '38%', duration: 7.5, delay: 0 },
  { top: '71%', width: '26%', duration: 11, delay: 2.4 },
  { top: '84%', width: '46%', duration: 9, delay: 4.8 },
] as const;
