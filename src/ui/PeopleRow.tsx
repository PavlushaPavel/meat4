import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { PeopleBlock, SamplePerson } from '@/content/types';
import { cn } from '@/lib/cn';

/**
 * Лента портретов внутри раздела конспекта: пятеро за одним запросом.
 *
 * ПОЧЕМУ ЭТО БУМАГА, А НЕ МЕТАЛЛ. Врезка живёт на листе конспекта, внутри акта
 * обучения, из которого мир намеренно выключен (docs/SPEC.md §3.3): ни неона,
 * ни жёлтой ленты, ни приборных панелей. Карточки покрашены только бумажными
 * токенами (`paper`, `paper-deep`, `paper-ink`, `paper-line`) — это фотографии,
 * приклеенные на страницу, а не образцы в стойке промзоны. Любой `metal-panel`
 * или `neon-edge` здесь означал бы, что человек снова в городе, хотя он сел
 * смотреть двадцать минут видео.
 *
 * ПОЧЕМУ ЛЕНТА, А НЕ КОЛОНКА И НЕ СЕТКА. Пять карточек в столбик на 360px — это
 * полтора экрана прокрутки внутри одного пункта конспекта: пока долистаешь до
 * Феди, забудешь, с чего начали, а вся мысль именно в том, что они стоят РЯДОМ
 * и неразличимы по запросу. Сетка 2×3 даёт дыру в шестой клетке и ломает счёт
 * «пятеро». Поэтому горизонтальная лента: два с половиной кадра в поле зрения,
 * обрез третьего сам говорит, что там есть ещё.
 *
 * ПРОКРУТКА НЕ УТАСКИВАЕТ СТРАНИЦУ. `overscroll-x-contain` не даёт жесту,
 * доехавшему до края ленты, продолжиться прокруткой всего экрана вбок, а
 * `overflow-hidden` на `body` закрывает вопрос окончательно. Лента получает
 * `tabIndex`, потому что прокручиваемая область без фокуса недостижима с
 * клавиатуры, и `aria-label` — потому что вслух это ряд, а не список из одной
 * карточки.
 *
 * ГЕОМЕТРИЯ РЕЗЕРВИРУЕТСЯ ДО ЗАГРУЗКИ. Ширина карточки фиксированная, окно
 * портрета — `aspect-[4/3]` под настоящий размер файлов (1200×900). Ни одна
 * картинка не двигает вёрстку, когда доедет, и ни одна не оставляет пустое
 * место, если не доедет вовсе.
 */
export function PeopleRow({ block }: { block: PeopleBlock }) {
  return (
    <figure className="mt-5">
      <p className="legend text-paper-ink-dim">{block.legend}</p>

      {/* Запрос набран моноширинным: это не слова автора, а строка, которую
          человек ввёл в поиск — ровно та же, что у остальных четверых. */}
      <p className="mt-1 font-mono text-small text-paper-ink">«{block.query}»</p>

      {/*
        Лента выходит за поля листа: фотографии лежат поперёк страницы от края
        до края, как вклейка. `px-5` возвращает внутренний отступ, чтобы первая
        карточка стояла по колонке текста, а не липла к обрезу.
      */}
      <ul
        tabIndex={0}
        aria-label={block.rowAria}
        className={cn(
          '-mx-5 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-5 py-1 scroll-px-5',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink',
        )}
      >
        {block.people.map((person, i) => (
          <PersonCard key={person.id} person={person} index={i} />
        ))}
      </ul>

      <figcaption className="mt-4 text-small leading-relaxed text-paper-ink-dim">
        {block.caption}
      </figcaption>
    </figure>
  );
}

/**
 * Одна карточка. Она обязана оставаться ЗАКОНЧЕННОЙ без фотографии: `onError`
 * переводит её в состояние, где вместо портрета стоит крупный номер образца.
 * Молча показывать сломанную иконку нельзя — это то же самое враньё, что
 * кнопка на несуществующую ссылку (docs/SPEC.md §3.7).
 *
 * Базовый путь обязателен: на GitHub Pages проект лежит в подкаталоге, и
 * `/samples/05.webp` там даёт 404 при существующем файле.
 */
function PersonCard({ person, index }: { person: SamplePerson; index: number }) {
  const [hasPhoto, setHasPhoto] = useState(true);
  const reduceMotion = useReducedMotion();
  const src = `${import.meta.env.BASE_URL}samples/${person.code}.webp`;

  // Тот, на ком ломается логика раздела. Выделен рамкой в цвет текста и
  // подложкой под подписью — так на бумаге обводят карандашом. Ни цвета
  // тревоги, ни перечёркивания: разбирается наша логика, а не человек.
  const pivot = Boolean(person.pivot);

  return (
    <motion.li
      className={cn(
        'relative flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-plate border bg-paper',
        pivot ? 'border-2 border-paper-ink' : 'border-paper-line',
      )}
      // Карточки проявляются одна за другой слева направо — ровно тем жестом,
      // которым автор их выкладывает на записи. Шаг мелкий: раздел спокойный,
      // и лента не должна выглядеть аттракционом. При системной настройке
      // «меньше движения» появление отменяется целиком, а не ускоряется.
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.26, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }
      }
    >
      <div className="relative aspect-[4/3] w-full bg-paper-deep">
        {hasPhoto && (
          <img
            src={src}
            /* Подпись под фотографией говорит всё, что нужно знать: второй раз
               то же самое в `alt` — это шум для скринридера, а выдуманное
               описание внешности человека мы не даём принципиально. */
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setHasPhoto(false)}
            className="absolute inset-0 size-full object-cover saturate-[0.85] contrast-[1.03]"
          />
        )}

        {!hasPhoto && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-paper-line"
          >
            {person.code}
          </span>
        )}

        {/* Марка образца поверх кадра. Она же единственное, что отличает
            карточки друг от друга, пока портреты грузятся. */}
        <span className="legend absolute left-1.5 top-1.5 bg-paper/85 px-1.5 py-0.5 text-paper-ink">
          {person.code}
        </span>
      </div>

      <div className={cn('flex-1 px-2.5 py-2', pivot && 'bg-paper-deep')}>
        <p className="font-display text-small font-semibold uppercase leading-tight tracking-wide text-paper-ink">
          {person.label}
        </p>
        <p className="mt-1 text-small leading-snug text-paper-ink-dim">
          {person.situation}
        </p>

        {person.pivot && (
          <p className="legend mt-2 border-t border-paper-line pt-1.5 text-paper-ink">
            {person.pivot}
          </p>
        )}
      </div>
    </motion.li>
  );
}
