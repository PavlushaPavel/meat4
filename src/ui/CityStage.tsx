import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { nextStep, type ActId, type StepKey } from '@/router/flow';
import { cn } from '@/lib/cn';
import { worldAsset } from './assets';

type SceneArt = {
  file: string;
  opacity: number;
  position?: string;
  filter?: string;
};

/**
 * Сценография привязана к смысловому повороту, а не к акту целиком. Раньше
 * четыре изображения повторялись на 24 экранах и превращались в обои. Теперь
 * город, исследование, контроль и сборка читаются как разные физические места.
 */
const SCENE_ART: Partial<Record<StepKey, SceneArt>> = {
  // Акт города. Кадр держит место действия, а внутри такта сцена меняет то,
  // на что человек смотрит (`src/scene/*`).
  preframe: { file: 'traffic-town-hero.webp', opacity: 0.62, position: '58% center' },
  conversion: { file: 'traffic-town-map.webp', opacity: 0.54 },
  audience: { file: 'traffic-town-map.webp', opacity: 0.48 },

  // Акт обучения фона НЕ ИМЕЕТ, и это решение, а не пропуск. Человек сел
  // смотреть двадцать минут: ночной город за плеером мешает читать конспект и
  // отбирает контраст у самого видео (docs/SPEC.md §3.3).

  // Акт лаборатории.
  test: { file: 'traffic-lab-exterior.webp', opacity: 0.52, position: 'center 58%' },
  bundle: { file: 'landing-assembly-line.webp', opacity: 0.44, position: 'center top' },
};

/**
 * КАК ЭКРАН ПОЯВЛЯЕТСЯ.
 *
 * Один общий переход на все тридцать шагов делал воронку ровной: карта,
 * распечатка и крупное утверждение въезжали одинаково, и ни один из них не
 * читался как событие. Здесь переход выбирается по СМЫСЛУ экрана, а не по
 * акту.
 *
 * `rise`     — распечатку кладут на стол: длиннее и снизу.
 * `pullback` — камера отъезжает: только на экранах карты, там это буквально
 *              то, что происходит с масштабом.
 * `slam`     — крупное утверждение приходит ударом: короткий наезд с
 *              перелётом. Только там, где на экране одна большая мысль.
 * `none`     — мессенджер не анимируется вообще: это другое приложение, и
 *              любой переход выдал бы в нём декорацию (docs/SPEC.md §3.3).
 * `default`  — всё остальное.
 */
type Enter = 'default' | 'rise' | 'pullback' | 'slam' | 'none';

const STEP_ENTER: Partial<Record<StepKey, Enter>> = {
  // Префрейм начинается с чёрного экрана и прилетевшего сообщения. Любой
  // переход здесь означал бы, что до сообщения что-то было.
  preframe: 'none',

  // Камера буквально поднимается над районами — это тот же жест, что и вход.
  conversion: 'pullback',
  audience: 'pullback',

  // Человек садится смотреть: страница кладётся снизу, как конспект на стол.
  video1: 'rise',
  video2: 'rise',
  video3: 'rise',

  // Закрытая дверь и собранная связка — по одному крупному утверждению.
  test: 'slam',
  bundle: 'slam',
};

const ENTER_MOTION: Record<
  Enter,
  { initial: Record<string, number>; transition: Record<string, unknown> }
> = {
  default: { initial: { opacity: 0, y: 10 }, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
  rise: { initial: { opacity: 0, y: 26 }, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
  pullback: {
    initial: { opacity: 0, scale: 1.05 },
    transition: { duration: 0.46, ease: [0.16, 1, 0.3, 1] },
  },
  slam: {
    initial: { opacity: 0, scale: 0.94 },
    transition: { type: 'spring', stiffness: 460, damping: 24, mass: 0.7 },
  },
  none: { initial: { opacity: 1 }, transition: { duration: 0 } },
};



/**
 * Сцена мира. Единственное место, где объявляется `data-act` — от него зависят
 * все цвета сцены (src/styles/tokens.css).
 *
 * Три слоя грязи поверх фона обязательны и всегда идут вместе: свет сверху,
 * зерно, виньетка. Без них тёмный фон читается как пустая чёрная заливка, а не
 * как ночной город (docs/SPEC.md §5.1).
 */
export function CityStage({
  act,
  step,
  children,
  className,
}: {
  act: ActId;
  step: StepKey;
  children: ReactNode;
  className?: string;
}) {
  const art = SCENE_ART[step];
  const enter = ENTER_MOTION[STEP_ENTER[step] ?? 'default'];
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const following = nextStep(step);
    const nextArt = following ? SCENE_ART[following] : null;
    if (!nextArt) return;
    const image = new Image();
    image.src = worldAsset(nextArt.file);
  }, [step]);

  return (
    <div
      data-act={act}
      data-step={step}
      data-scene={art?.file.replace('.webp', '')}
      className={cn(
        'relative min-h-dvh bg-scene text-ink transition-colors duration-700',
        className,
      )}
      style={{ transitionTimingFunction: 'var(--ease-town)' }}
    >
      <AnimatePresence initial={false}>
        {art && (
          <motion.div
            key={art.file}
            className="stage-art"
            style={{
              backgroundImage: `url("${worldAsset(art.file)}")`,
              backgroundPosition: art.position,
              filter: art.filter,
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 1.025 }}
            animate={{ opacity: art.opacity, scale: 1.015 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <div className="stage-scrim" aria-hidden="true" />
      <div className="stage-light" aria-hidden="true" />
      <div className="stage-grain" aria-hidden="true" />
      <div className="stage-vignette" aria-hidden="true" />
      <motion.main
        key={step}
        className="relative z-10"
        initial={reduceMotion ? false : enter.initial}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : enter.transition}
      >
        {children}
      </motion.main>
    </div>
  );
}

/**
 * Кадр внутри контента. Он резервирует геометрию изображения до загрузки,
 * поэтому новые сцены не создают CLS и не превращаются в едва видимые обои.
 */
export function ScenePanel({
  asset,
  alt,
  children,
  className,
  imageClassName,
}: {
  asset: string;
  alt: string;
  children?: ReactNode;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <figure
      className={cn(
        'scene-panel relative isolate overflow-hidden rounded-panel border border-line bg-scene-deep',
        className,
      )}
    >
      <img
        src={worldAsset(asset)}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('absolute inset-0 size-full object-cover', imageClassName)}
      />
      <div className="scene-panel-scrim absolute inset-0" aria-hidden="true" />
      {children && <div className="absolute inset-0">{children}</div>}
    </figure>
  );
}

/**
 * Каркас экрана: одна колонка под большой палец, безопасные отступы Telegram,
 * место под липкое действие внизу.
 */
export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('mx-auto flex w-full max-w-screen-sm flex-col px-5', className)}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </div>
  );
}
