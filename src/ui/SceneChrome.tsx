import { motion, useReducedMotion } from 'motion/react';
import { chromeUi } from '@/content/scene';
import { calm, spring, tween, dur } from '@/scene/motion';
import { haptics } from '@/lib/telegram';
import { cn } from '@/lib/cn';

/**
 * Постоянная рама сцены: шапка и подвал.
 *
 * ЗАЧЕМ ОНА ВООБЩЕ НУЖНА. По референсу заказчика сцена устроена как афиша:
 * город на весь экран, автор крупной фигурой, поверх — плеер и текст. У
 * полноэкранной фотографии нет ни верха, ни низа, и без рамы вся конструкция
 * расползается: непонятно, где кончается кадр и начинается приложение. Рама и
 * есть эта граница — она не украшение, а единственное, что делает афишу
 * экраном.
 *
 * ОБЕ ПОЛОСЫ НИЧЕГО НЕ РЕШАЮТ САМИ. Ни своего места на экране, ни своего
 * состояния: раскладку задаёт сцена через `className`, состояние приходит
 * пропсами. Полоса, которая сама решает, что она `fixed`, ломает любую
 * композицию, кроме той, под которую её написали.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. На референсе справа в шапке стоит круглая кнопка «…». Меню за
 * ней пока не существует, и она не нарисована вовсе. Кнопка, которая ничего не
 * открывает, — это не симметрия, а обещание; честное состояние важнее
 * уравновешенной шапки (`chromeUi.more` ждёт в контенте своего меню).
 */

/**
 * Порог, за которым точки шагов перестают быть точками.
 *
 * ПОЧЕМУ СЕМЬ. Считаем ширину: на экране 360px подвал делят полоса шагов и
 * пилюля звука (та занимает около 140px вместе с отступами). Полосе остаётся
 * примерно 180px. Одна точка — 24px, пунктирная перемычка между ними — не
 * меньше 20px, иначе пунктир вырождается в две чёрточки и читается как мусор.
 * Семь точек с шестью перемычками — это 7×24 + 6×20 = 288px… уже не влезает,
 * но точки сжимаемы до 22px, а перемычки тянутся резиновыми: до семи полоса
 * ужимается без потери смысла, на восьмой начинает лгать — либо номера
 * становятся нечитаемыми, либо пунктир исчезает и точки слипаются в гусеницу.
 *
 * ПОЧЕМУ НЕ «СЧИТАТЬ ПО ФАКТИЧЕСКОЙ ШИРИНЕ». Измерение через ResizeObserver
 * дало бы точный ответ и цену: подвал начал бы перекладываться на первом кадре
 * и при каждом повороте телефона. Прыгающая рама хуже, чем рама, которая на
 * один шаг раньше перешла в компактный вид.
 *
 * ЧТО ВМЕСТО ТОЧЕК. Не «те же точки, только мельче» — мелкие точки без номеров
 * не сообщают ничего, кроме тревоги «как ещё много». Вместо них тонкая шкала с
 * номером: «5 / 12» отвечает на оба вопроса — где я и сколько всего — и
 * занимает ширину строки, а не всей полосы.
 */
const DOTS_MAX = 7;

/**
 * Шапка: марка слева, место справа-по-центру.
 *
 * ДВИЖЕНИЯ ЗДЕСЬ НЕТ СОЗНАТЕЛЬНО. Рама — постоянная величина сцены, точка
 * отсчёта для всего, что внутри неё меняется. Появляющаяся или дышащая рама
 * превращает опору в ещё одно событие, за которым надо следить.
 */
export function SceneTopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn('flex w-full items-center justify-between gap-3 px-4 py-3', className)}
    >
      {/*
        Марка в две строки. Перенос приходит из контента разложенным на строки:
        он часть знака, а не вёрстки.
      */}
      <p className="shrink-0 leading-none">
        <span className="block font-display text-base font-bold tracking-tight text-hazard">
          {chromeUi.brand.top}
        </span>
        {/* Разрядка второй строки подогнана так, чтобы обе строки кончались
            примерно на одной вертикали: марка — это блок, а не две подписи. */}
        <span className="mt-1 block font-display text-legend font-light tracking-[0.42em] text-ink-dim">
          {chromeUi.brand.bottom}
        </span>
      </p>

      {/*
        Пилюля места. Не кнопка и не статус — табличка «вы находитесь здесь»:
        мини-апп открывается внутри мессенджера, и это единственное место, где
        об этом сказано прямо. Прижата вправо, потому что справа пусто: пока
        меню нет, геометрический центр шапки был бы центром пустоты.
      */}
      <p className="ml-auto flex items-center gap-2 rounded-full border border-line bg-scene-deep/70 px-3 py-1.5 backdrop-blur-sm">
        <PlaneMark />
        <span className="font-display text-small leading-none text-ink-dim">
          {chromeUi.platform}
        </span>
      </p>
    </header>
  );
}

/**
 * Подвал: ход рассказа слева, звук справа.
 *
 * ПОЧЕМУ ЗВУК ЖИВЁТ В РАМЕ, А НЕ В ПЛЕЕРЕ. Плеер управляет ОДНОЙ записью, а эта
 * кнопка — всем звуком приложения; смешать их значило бы получить два выключателя
 * с пересекающимся смыслом. Кроме того, вступление держится на голосе, и человек
 * должен видеть, включён ли он, ещё до того, как дошёл до плеера.
 */
export function SceneBottomBar({
  total,
  index,
  soundOn,
  onSound,
  className,
}: {
  /** Сколько шагов в рассказе. */
  total: number;
  /** Текущий шаг, с нуля. */
  index: number;
  soundOn: boolean;
  onSound: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  // Шаг может прийти за границами: сцена перематывается, а рассказ
  // достраивается. Полоса не имеет права показать «0 / 3» или «4 / 3» — это
  // выглядит как поломка приложения, а не как край рассказа.
  const safeTotal = Math.max(1, Math.floor(total));
  const current = Math.min(safeTotal - 1, Math.max(0, Math.floor(index)));

  return (
    <footer className={cn('flex w-full items-center gap-3 px-4 py-3', className)}>
      <div
        role="progressbar"
        aria-label={chromeUi.stepsAria}
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-valuenow={current + 1}
        className="flex min-w-0 flex-1 items-center"
      >
        {safeTotal > DOTS_MAX ? (
          <CompactSteps total={safeTotal} current={current} reduce={reduceMotion} />
        ) : (
          <Dots total={safeTotal} current={current} reduce={reduceMotion} />
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          // Служебный переключатель — лёгкий импульс, как у второстепенного
          // действия в `Button.tsx`. Отклик живёт в компоненте, а не на экране.
          haptics.light();
          onSound();
        }}
        aria-pressed={soundOn}
        className={cn(
          'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4',
          'transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)]',
          'border-line bg-scene-deep/70 backdrop-blur-sm',
          // Состояние передаёт ЯРКОСТЬ, а не цвет. Жёлтым в этом мире покрашено
          // главное действие, и на экране оно ровно одно — им уже покрашена
          // кнопка плеера. Жёлтая пилюля в углу спорила бы с ней за то же
          // значение, а служебный переключатель звука на него не претендует.
          // Слово в пилюле и так называет состояние прямо.
          soundOn ? 'text-ink' : 'text-ink-dim',
        )}
      >
        <Headphones />
        <span className="legend">{soundOn ? chromeUi.sound.on : chromeUi.sound.off}</span>
      </button>
    </footer>
  );
}

/**
 * Точки шагов: пройденные, текущая и те, до которых ещё не дошли.
 *
 * ТОЧКИ НЕ НАЖИМАЮТСЯ. У сцены нет перемотки по шагам (docs/SPEC.md §2.1), и
 * кликабельная на вид отметка обещала бы навигацию, которой нет. Поэтому это
 * индикатор целиком: ни одна точка не является целью для пальца, и требование
 * 44px к ним не относится.
 */
function Dots({
  total,
  current,
  reduce,
}: {
  total: number;
  current: number;
  reduce: boolean | null;
}) {
  return (
    <ol aria-hidden="true" className="flex min-w-0 flex-1 items-center">
      {Array.from({ length: total }, (_, i) => {
        const passed = i < current;
        const isCurrent = i === current;

        return (
          <li key={i} className={cn('flex items-center', i > 0 && 'min-w-0 flex-1')}>
            {i > 0 && (
              // Перемычка. Пунктир — не декор: сплошная линия читалась бы как
              // шкала заполнения, а рассказ не наливается, он идёт шагами.
              <span
                className={cn(
                  'mx-1.5 h-0 min-w-0 flex-1 border-t border-dashed',
                  i <= current ? 'border-hazard/30' : 'border-line',
                )}
              />
            )}

            {isCurrent ? (
              <motion.span
                // Ключ по индексу: при смене шага отметка монтируется заново и
                // «приезжает» на место. Это единственное движение подвала, и
                // оно отмечает событие — рассказ сдвинулся.
                key={current}
                initial={reduce ? false : { scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={calm(reduce, spring.mark)}
                className="grid size-6 shrink-0 place-items-center rounded-full bg-hazard font-display text-legend font-semibold text-on-hazard shadow-[0_0_16px_-3px_var(--color-hazard)]"
              >
                {i + 1}
              </motion.span>
            ) : (
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border font-display text-legend',
                  // Пройденное помечено кромкой, а не заливкой: залитых
                  // жёлтым отметок на полосе должна быть ровно одна — та,
                  // где человек сейчас.
                  passed ? 'border-hazard/50 text-hazard/70' : 'border-line text-ink-dim',
                )}
              >
                {i + 1}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Компактный вид: тонкая шкала и номер. Включается, когда точек больше
 * `DOTS_MAX` (объяснение порога — у самой константы).
 *
 * Здесь шкала СПЛОШНАЯ, в отличие от пунктира между точками, и это осознанно:
 * на длинном рассказе отдельные шаги уже не различимы и не важны, важна доля
 * пути. Ровно то, для чего сплошная шкала и существует.
 */
function CompactSteps({
  total,
  current,
  reduce,
}: {
  total: number;
  current: number;
  reduce: boolean | null;
}) {
  const ratio = (current + 1) / total;

  return (
    <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-2.5">
      <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-line">
        <motion.span
          className="block h-full origin-left rounded-full bg-hazard"
          initial={false}
          animate={{ scaleX: ratio }}
          transition={calm(reduce, tween(dur.base))}
          // Ширина задаётся полной, а доля — сжатием по оси: анимировать
          // трансформацию дешевле, чем ширину, и она не вызывает пересчёт
          // компоновки на каждом кадре.
          style={{ width: '100%' }}
        />
      </div>
      <span className="shrink-0 font-display text-small tabular-nums text-ink-dim">
        <span className="text-hazard">{current + 1}</span> / {total}
      </span>
    </div>
  );
}

/**
 * Самолётик Telegram. Нарисован вектором на месте: внешних файлов в проекте нет,
 * а иконочный шрифт ради одного знака — лишний сетевой запрос на первом экране.
 *
 * Цвет — `tg-ink` из диегетической палитры мессенджера, а не `ink`: знак
 * принадлежит Telegram, и это единственное место рамы, где мир на секунду
 * цитирует чужую поверхность.
 */
function PlaneMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0 fill-tg-ink">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

/** Наушники: знак того, что вступление слушают, а не читают. */
function Headphones() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="2.5" y="14" width="4" height="6.5" rx="2" fill="currentColor" stroke="none" />
      <rect x="17.5" y="14" width="4" height="6.5" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
