import { Fragment, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { bundleFinale } from '@/content/city';
import { externalUrl } from '@/lib/env';
import { useNav } from '@/router/useNav';
import { useFunnel } from '@/store/funnel';
import { AuthorLine, AuthorNote } from '@/ui/AuthorNote';
import { Button } from '@/ui/Button';
import { ScenePanel, Screen } from '@/ui/CityStage';
import { ConversionChain } from '@/ui/ConversionChain';
import { ExternalButton } from '@/ui/ExternalButton';
import { MetalPanel } from '@/ui/MetalPanel';
import { Legend, Plate } from '@/ui/Plate';
import { CHAIN, HOME_SOURCE, LAB_NAME, ZONES } from '@/world';
import { haptics } from '@/lib/telegram';

/**
 * Шаг 8. Финал: связка собрана, доказательство, цена.
 *
 * ЭТО ДВА СОСТОЯНИЯ ПРОДУКТА НА ОДНОМ ЭКРАНЕ, и отдельным шагом маршрута
 * продажа не является (`src/router/flow.ts`). Причина не в экономии экранов:
 * предложение обязано стоять там же, где стоит собранная связка, иначе оно
 * снова превращается в страницу курса, оторванную от того, что человек только
 * что видел своими глазами.
 *
 *   А — связка собрана. Три детали на месте, поток пошёл. Главное действие:
 *       ПОТЫКАТЬ САЙТ. Не скриншот и не описание — живая страница.
 *   Б — предложение. Раскрывается после того, как человек сходил смотреть.
 *
 * ПОЧЕМУ ЦЕНА НЕ ЗАПЕРТА ЗА КНОПКОЙ САЙТА. Ссылки сейчас нет — сайт не собран,
 * `VITE_LANDING_DEMO_URL` пуст, и кнопка честно неактивна (docs/SPEC.md §3.7).
 * Если бы состояние Б открывалось только ею, воронка прямо сейчас НЕ ДОХОДИЛА
 * БЫ ДО ПРОДАЖИ ВООБЩЕ. Поэтому рядом всегда стоит вторая кнопка, и она тоже
 * поднимает `proofOpened`. Ни один человек не должен упереться в тупик.
 */
export function BundleScreen() {
  const { step } = useNav();
  const proofOpened = useFunnel((s) => s.proofOpened);
  const openProof = useFunnel((s) => s.openProof);
  const assemble = useFunnel((s) => s.assemble);
  const reduceMotion = useReducedMotion();

  /**
   * Последняя деталь встаёт на место ВМЕСТЕ С ЭКРАНОМ: в отличие от аудитории,
   * посадку человек не наблюдает — он приходит сюда из третьего видео уже к
   * собранной связке, и первое, что видит, это горящую ПОСАДКУ на карте.
   * Расписание участков (`ZONE_SCHEDULE`) открывает её ровно на этом шаге, а
   * стор обязан говорить о собранных деталях то же самое: половина правды в
   * `artifacts` — это будущий отчёт «всё собрано» на несобранной связке.
   */
  useEffect(() => {
    assemble('landing');
    // Связка замкнулась. Тот же отклик, что у первой детали: последняя ничем
    // не «главнее» — важен не участок, а то, что цепочка собралась целиком.
    haptics.medium();
  }, [assemble]);

  /**
   * Есть ли вообще куда идти смотреть. От этого зависит не только вид кнопки
   * сайта, но и роль второй кнопки: при живой ссылке она второстепенная, при
   * пустой — единственный путь вперёд, то есть главное действие экрана.
   */
  const proofLinkExists = externalUrl(bundleFinale.proof.action.envVar) !== '';

  return (
    <Screen className="min-h-dvh gap-6">
      {/* Неон — только для открытого и живого. Здесь ему самое место. */}
      <h1 className="neon-ink font-display text-title font-semibold uppercase leading-tight">
        {bundleFinale.status}
      </h1>

      <ConversionChain step={step} />
      <FlowLine />

      <AuthorNote>
        {bundleFinale.assembled.map((line) => (
          <AuthorLine key={line}>{line}</AuthorLine>
        ))}
      </AuthorNote>

      <AnimatePresence mode="wait" initial={false}>
        {proofOpened ? (
          <motion.section
            key="offer"
            className="flex flex-col gap-7"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <AuthorNote>
              {bundleFinale.final.map((line) => (
                <AuthorLine key={line}>{line}</AuthorLine>
              ))}
            </AuthorNote>

            <Honesty />
            <Domino />
            <Product />

            {/* Главное действие состояния Б. Оплаты пока нет — кнопка честно
                неактивна с подписью, а не ведёт в никуда. */}
            <ExternalButton action={bundleFinale.checkout} />
          </motion.section>
        ) : (
          <motion.section
            key="proof"
            className="flex flex-col gap-4"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <AuthorNote>
              <AuthorLine>{bundleFinale.invite}</AuthorLine>
            </AuthorNote>

            {/*
              Обёртка ловит всплывший клик по ЖИВОЙ кнопке сайта: сама
              `ExternalButton` наружу о нажатии не сообщает, а знать об этом
              обязательно — человек уходит во внешний браузер и возвращается
              уже к предложению. Обработчик не делает обёртку интерактивной:
              нажимаемый элемент внутри — настоящая кнопка, здесь только
              наблюдение. При пустой ссылке кнопки нет вовсе, и вешать
              наблюдателя не на что.
            */}
            <div onClickCapture={proofLinkExists ? openProof : undefined}>
              <ExternalButton action={bundleFinale.proof.action} />
            </div>

            <Button
              variant={proofLinkExists ? 'ghost' : 'hazard'}
              onClick={openProof}
              arrow
            >
              {proofLinkExists ? bundleFinale.proof.seen : bundleFinale.proof.missing}
            </Button>
          </motion.section>
        )}
      </AnimatePresence>
    </Screen>
  );
}

/**
 * Подпись под картой: поток пошёл и он КОНКРЕТНЫЙ.
 *
 * Карта показывает участки по именам, а эта строка — что за ними теперь стоит
 * не «аудитория вообще», а вот эта. Первое звено берётся из `HOME_SOURCE`:
 * имя района объявлено в мире и в копирайт не копируется.
 */
function FlowLine() {
  const steps = [HOME_SOURCE.name, ...bundleFinale.flow.steps];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Legend tone="neon">{bundleFinale.flow.prefix}</Legend>
      {steps.map((name, i) => (
        <Fragment key={name}>
          {i > 0 && (
            <span aria-hidden="true" className="text-neon">
              →
            </span>
          )}
          <span className="text-small text-ink-dim">{name}</span>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Три участка, которые не загорелись.
 *
 * Список берётся из мира: недостижимые участки помечены в `ZONES` полем
 * `attainable`, и переписать их сюда строками значило бы завести второе место,
 * где решается, что человек контролирует. Копирайт говорит «эти три участка»
 * и остаётся верным, даже если границу когда-нибудь передвинут.
 *
 * Тон спокойный, отбивка тонкая: это не извинение за недоделку, а объяснение
 * позиции. Кричать здесь нечем и незачем.
 */
function Honesty() {
  const closed = CHAIN.filter((id) => !ZONES[id].attainable);
  const last = bundleFinale.honesty.lines.length - 1;

  return (
    <section className="flex flex-col gap-3 border-y border-line py-5">
      <Legend tone="dim">{bundleFinale.honesty.title}</Legend>

      <ul className="flex flex-wrap gap-2">
        {closed.map((id) => (
          <li
            key={id}
            className="legend rounded-plate border border-line px-2 py-1 text-ink-dim"
          >
            {ZONES[id].name}
          </li>
        ))}
      </ul>

      {bundleFinale.honesty.lines.map((line, i) => (
        // Последняя строка — вывод, ради которого написаны две первые.
        <p
          key={line}
          className={i === last ? 'text-base leading-relaxed text-ink' : 'text-base leading-relaxed text-ink-dim'}
        >
          {line}
        </p>
      ))}
    </section>
  );
}

/**
 * Лестница домино: семь ступеней, по которым воронка пришла к цене.
 *
 * Ступени проявляются по очереди — это единственная анимация состояния Б, и
 * она диегетическая: домино падает. При `prefers-reduced-motion` задержки
 * обнуляются, ступени встают разом, но ПОРЯДОК на экране прежний — сверху
 * причина, снизу следствие.
 */
function Domino() {
  const reduceMotion = useReducedMotion();
  const steps = bundleFinale.domino.steps;
  // Две последние ступени — вывод про деньги, а не про инструмент. Они ярче.
  const conclusionFrom = steps.length - 2;

  return (
    <section className="flex flex-col gap-3">
      <Legend tone="dim">{bundleFinale.domino.title}</Legend>

      <ol className="flex flex-col gap-2">
        {steps.map((text, i) => (
          <motion.li
            key={text}
            initial={reduceMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: reduceMotion ? 0 : i * 0.07,
              duration: reduceMotion ? 0 : 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex gap-3 border-l border-line pl-3"
          >
            <span className="legend shrink-0 pt-0.5 text-neon">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className={
                i >= conclusionFrom
                  ? 'text-small leading-relaxed text-ink'
                  : 'text-small leading-relaxed text-ink-dim'
              }
            >
              {text}
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Карточка продукта.
 *
 * Жёлтая табличка на ней — единственная на экране: это дверь, за которой
 * начинается платное, а опасная краска стоит там, где закрыто (docs/SPEC.md
 * §5.3). Имя продукта берётся из `LAB_NAME` — оно объявлено в мире один раз, и
 * переименование не должно превращаться в вычистку проекта.
 *
 * Цена стоит НЕ ГОЛОЙ, а сразу под составом: человек видит объём того, за что
 * платит, в том же кадре, что и число.
 */
function Product() {
  const p = bundleFinale.product;

  return (
    <MetalPanel rivets className="flex flex-col gap-5 p-5">
      <Plate worn={false} className="self-start">
        <span className="font-display text-lg font-semibold uppercase tracking-wide">
          {LAB_NAME}
        </span>
      </Plate>

      {/*
        Кадр собственной сборочной линии — буквально то, что продаётся: не чужой
        цех, в который пустили посмотреть, а линия, которую человек уносит с
        собой. Это единственная картинка на экране цены, и стоит она до обещания
        по той же причине, по которой в воронке вообще есть город: показать
        сильнее, чем назвать.
      */}
      <ScenePanel
        asset="own-line-kit.webp"
        alt={p.frameAlt}
        className="aspect-[16/9] -mx-1"
      />

      <p className="text-lead leading-snug text-ink">{p.promise}</p>

      <div className="flex flex-col gap-2">
        {/* Чем это НЕ является — раньше, чем чем является: возражение снимается
            до того, как человек успеет его придумать. */}
        <p className="text-small text-ink-dim">{p.notWhat}</p>
        <p className="text-base leading-relaxed text-ink">{p.what}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Legend tone="dim">{p.insideTitle}</Legend>
        <ul className="flex flex-wrap gap-1.5">
          {p.inside.map((item) => (
            <li
              key={item}
              className="legend rounded-plate border border-line px-2 py-1 text-ink-dim"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-baseline gap-3 border-t border-line pt-4">
        <Legend tone="dim">{p.priceLabel}</Legend>
        <span className="font-display text-hero font-semibold leading-none text-hazard">
          {p.price}
        </span>
      </div>
    </MetalPanel>
  );
}
