import { useMemo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Силуэт ночного города: промзона на горизонте, в окнах кое-где горит свет.
 *
 * Рисуется блоками, а не картинкой: растровых ассетов в проекте нет
 * (docs/SPEC.md §5.6). Форма зданий детерминирована — считается один раз из
 * фиксированного набора, чтобы город не перестраивался на каждой перерисовке.
 * Мигающий на ререндере горизонт выглядел бы как сбой, а не как жизнь.
 */
export function CitySkyline({ className }: { className?: string }) {
  const buildings = useMemo(() => BUILDINGS, []);

  return (
    <div
      aria-hidden="true"
      className={cn('flex h-24 w-full items-end justify-center gap-[3px] overflow-hidden', className)}
    >
      {buildings.map((b, i) => (
        <div
          key={i}
          className="relative shrink-0 bg-scene-deep"
          style={{ height: `${b.h}%`, width: `${b.w}px` }}
        >
          {/* Тонкая кромка сверху — крыша ловит свет уличных фонарей. */}
          <span className="absolute inset-x-0 top-0 h-px bg-line" />
          {/* Освещённые окна: сетка точек, часть из них горит. */}
          <span
            className="absolute inset-x-1 top-2 bottom-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at center, color-mix(in oklab, var(--color-hazard) 55%, transparent) 0 1px, transparent 1.4px)',
              backgroundSize: '7px 11px',
              opacity: b.lit,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Профиль горизонта. Высота в процентах, ширина в пикселях, `lit` — доля
 * горящих окон. Набор подобран руками: случайная генерация давала то забор из
 * одинаковых столбов, то расчёску.
 */
const BUILDINGS: Array<{ h: number; w: number; lit: number }> = [
  { h: 42, w: 22, lit: 0.18 },
  { h: 68, w: 16, lit: 0.32 },
  { h: 30, w: 28, lit: 0.12 },
  { h: 86, w: 20, lit: 0.4 },
  { h: 54, w: 14, lit: 0.22 },
  { h: 72, w: 26, lit: 0.3 },
  { h: 38, w: 18, lit: 0.14 },
  { h: 96, w: 12, lit: 0.5 },
  { h: 48, w: 24, lit: 0.2 },
  { h: 62, w: 16, lit: 0.34 },
  { h: 34, w: 30, lit: 0.1 },
  { h: 78, w: 18, lit: 0.36 },
  { h: 44, w: 20, lit: 0.16 },
  { h: 58, w: 14, lit: 0.26 },
];
