/**
 * Город трафика: районы трафика, участки связки и туман (docs/SPEC.md §1).
 *
 * Чистые данные и функции — без React, без DOM, без побочных эффектов.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ. Смысл воронки держится не на тексте, а на карте:
 * человек начинает внутри одного рекламного кабинета, а заканчивает, видя всю
 * дорогу от клика до денег клиента — и понимая, какую её часть он теперь
 * контролирует сам. Значит, состояние карты обязано быть ФУНКЦИЕЙ ШАГА, а не
 * набором флагов, которые кто-то не забыл выставить. Ниже одна таблица «когда
 * участок меняет состояние», и `zoneState()` считает по ней. Забыть открыть
 * участок здесь физически нельзя: карта ничего не решает сама.
 *
 * ПЕРЕСОБРАНО 11.08.2026: у прежней воронки цепочка начиналась с аудитории и
 * кончалась отделом продаж, а район был её звеном. Теперь это две разные
 * сущности, и путать их нельзя:
 *
 *   РАЙОНЫ ТРАФИКА  — способы ПРИВЕСТИ человека. Их можно копить (`SOURCES`).
 *   РАЙОН КОНВЕРСИЙ — то, что решает, станет ли приведённый человек
 *                     деньгами. Его можно только ОТКРЫВАТЬ по участкам.
 *
 * Вся мысль воронки в том, что первое расширяется вбок и упирается в потолок,
 * а второе — вверх и потолка не имеет.
 */
import { STEPS, stepIndex, type StepKey } from './router/flow';

// ---------------------------------------------------------------------------
// Районы трафика
// ---------------------------------------------------------------------------

/**
 * Районы трафика на карте города.
 *
 * Человек воронки живёт в `direct` — это единственная персона продукта, и
 * весь текст говорит языком Директа напрямую. Остальные три района НЕ являются
 * альтернативными персонами: это соседние кварталы, которым можно доучиться и
 * продавать клиенту. Прежняя воронка предлагала выбрать один из трёх и
 * подставляла имя в текст; здесь выбора нет, и это осознанно — сценарий
 * заказчика написан голосом директолога от первой до последней строки.
 *
 * Telegram Ads возвращён 11.08.2026 по прямой просьбе заказчика. Его убирали
 * из прежней воронки, когда он был ПЕРСОНОЙ («эти специалисты максимально
 * далеко»). Здесь он не персона, а один из каналов в чужом медиамиксе —
 * возражение снято.
 */
export type SourceId = 'direct' | 'vk' | 'avito' | 'tg';

export interface Source {
  id: SourceId;
  /** Вывеска района на карте. Латиница — это городская вывеска, а не термин. */
  name: string;
  /** Что это на самом деле. Идёт мелкой строкой под именем. */
  channel: string;
  /** Знак района на плитке. Одна-две буквы, читается на мобильном. */
  glyph: string;
}

export const SOURCES: readonly Source[] = [
  { id: 'direct', name: 'DIRECT DISTRICT', channel: 'Яндекс Директ', glyph: 'Я' },
  { id: 'vk', name: 'VK ADS', channel: 'ВКонтакте', glyph: 'VK' },
  { id: 'avito', name: 'AVITO', channel: 'Авито', glyph: 'A' },
  { id: 'tg', name: 'TG ADS', channel: 'Telegram Ads', glyph: 'TG' },
];

/** Район героя. Единственное место, где записано, кто перед нами. */
export const HOME_SOURCE: Source = SOURCES[0];

/** Соседние районы — то, чему можно доучиться. Герой в них не живёт. */
export const NEIGHBOUR_SOURCES: readonly Source[] = SOURCES.slice(1);

// ---------------------------------------------------------------------------
// Conversion District
// ---------------------------------------------------------------------------

/**
 * Имя лаборатории. ЕДИНСТВЕННОЕ МЕСТО, где оно записано.
 *
 * В прежней редакции имя лежало литералами в сорока четырёх местах двадцати
 * файлов, и переименование по просьбе заказчика превратилось в вычистку всего
 * проекта. Больше так не делаем.
 *
 * С 11.08.2026 это ещё и название платного продукта за 3 990 ₽: лаборатория,
 * в которую человек входит в конце бесплатной воронки, и есть то, чему он
 * идёт учиться. Совпадение намеренное.
 */
export const LAB_NAME = 'TRAFFIC LAB';

/**
 * Имя центрального района. ЕДИНСТВЕННОЕ МЕСТО, где оно записано.
 *
 * По-русски с 12.08.2026: на присланных заказчиком кадрах города вывески
 * написаны кириллицей — «ГОРОД ТРАФИКА», «РАЙОН КОНВЕРСИЙ». Латиница в
 * интерфейсе спорила бы с тем, что человек видит на самой картинке.
 *
 * Имя лаборатории осталось латиницей намеренно: на нашивке защитного костюма
 * автора написано ровно `TRAFFIC LAB`, и это же имя носит платный продукт.
 */
export const DISTRICT_NAME = 'Район конверсий';

export type ZoneId =
  | 'traffic'
  | 'audience'
  | 'offer'
  | 'landing'
  | 'lead'
  | 'qual'
  | 'sale';

/**
 * Состояние участка связки.
 *
 * `fog`   — тумана не отличить от пустоты: ни контура, ни имени.
 * `shape` — контур проступил, имени ещё нет. «Ты знаешь, что там что-то есть».
 * `known` — имя видно, участок не твой. Серый, в связку не входит.
 * `open`  — твой: светится, деталь стоит на месте, поток через неё идёт.
 */
export type ZoneState = 'fog' | 'shape' | 'known' | 'open';

export interface Zone {
  id: ZoneId;
  /** Имя на карте. */
  name: string;
  /** Строка под именем: что здесь решается. */
  caption: string;
  /**
   * Может ли участок вообще стать твоим. `false` — не недоделка, а тезис
   * продукта: продажу целиком ты не контролируешь (см. `ZONE_SCHEDULE`).
   */
  attainable: boolean;
}

/** Порядок связки сверху вниз — он же порядок отрисовки потока. */
export const CHAIN: readonly ZoneId[] = [
  'traffic',
  'audience',
  'offer',
  'landing',
  'lead',
  'qual',
  'sale',
];

export const ZONES: Record<ZoneId, Zone> = {
  traffic: {
    id: 'traffic',
    name: 'ТРАФИК',
    caption: 'Откуда придёт человек',
    attainable: true,
  },
  audience: {
    id: 'audience',
    name: 'АУДИТОРИЯ',
    caption: 'Кто он и почему покупает',
    attainable: true,
  },
  offer: {
    id: 'offer',
    name: 'ОФФЕР',
    caption: 'Что мы ему говорим',
    attainable: true,
  },
  landing: {
    id: 'landing',
    name: 'ПОСАДКА',
    caption: 'Куда он попадёт после клика',
    attainable: true,
  },
  lead: {
    id: 'lead',
    name: 'ЛИД',
    caption: 'Заявка',
    attainable: false,
  },
  qual: {
    id: 'qual',
    name: 'КВАЛ',
    caption: 'Кого ОП считает целевым',
    attainable: false,
  },
  sale: {
    id: 'sale',
    name: 'ПРОДАЖА',
    caption: 'Менеджеры, CRM, цена, продукт',
    attainable: false,
  },
};

/**
 * Участки, которые человек забирает себе по ходу воронки. Ровно три детали
 * связки, ровно три видео. Четвёртой не будет: `traffic` был у него с самого
 * начала, а `lead`, `qual` и `sale` не станут его никогда.
 */
export const ARTIFACTS = ['audience', 'offer', 'landing'] as const;
export type ArtifactId = (typeof ARTIFACTS)[number];

/**
 * Когда участок меняет состояние. `null` — никогда.
 *
 * ЛИД, КВАЛ и ПРОДАЖА не открываются НИКОГДА, и это весь тезис продукта: ты
 * можешь контролировать значительно большую часть пути до денег, но не путь
 * целиком, и обещать обратное — врать (docs/SPEC.md §1.2). Ставить им `openAt`
 * запрещено, закрыто тестом `src/world.test.ts`.
 */
const ZONE_SCHEDULE: Record<
  ZoneId,
  { shapeAt: StepKey | null; knownAt: StepKey | null; openAt: StepKey | null }
> = {
  // Рекламный кабинет был у человека всегда — с ним он и пришёл.
  traffic: { shapeAt: 'preframe', knownAt: 'preframe', openAt: 'preframe' },

  // Подъём в Conversion District: участки получают имена, но ни один не твой.
  audience: { shapeAt: 'conversion', knownAt: 'conversion', openAt: 'audience' },
  offer: { shapeAt: 'conversion', knownAt: 'conversion', openAt: 'test' },
  landing: { shapeAt: 'conversion', knownAt: 'conversion', openAt: 'bundle' },

  // Дальше связки начинается чужая территория. Имена есть, ключей нет.
  lead: { shapeAt: 'conversion', knownAt: 'conversion', openAt: null },
  qual: { shapeAt: 'conversion', knownAt: 'conversion', openAt: null },
  sale: { shapeAt: 'conversion', knownAt: 'conversion', openAt: null },
};

/** Достигнут ли шаг `mark` к моменту `step`. `null` — никогда не достигнут. */
function reached(step: StepKey, mark: StepKey | null): boolean {
  return mark !== null && stepIndex(step) >= stepIndex(mark);
}

/** Состояние участка на данном шаге. Единственный способ его узнать. */
export function zoneState(id: ZoneId, step: StepKey): ZoneState {
  const s = ZONE_SCHEDULE[id];
  if (reached(step, s.openAt)) return 'open';
  if (reached(step, s.knownAt)) return 'known';
  if (reached(step, s.shapeAt)) return 'shape';
  return 'fog';
}

/** Состояния всех участков разом — то, что рисует карта. */
export function cityAt(step: StepKey): Record<ZoneId, ZoneState> {
  return Object.fromEntries(
    (Object.keys(ZONES) as ZoneId[]).map((id) => [id, zoneState(id, step)]),
  ) as Record<ZoneId, ZoneState>;
}

/**
 * Детали связки, которые уже стоят на месте, сверху вниз. Это и есть «то, что
 * ты теперь контролируешь».
 */
export function openChain(step: StepKey): ZoneId[] {
  return CHAIN.filter((id) => zoneState(id, step) === 'open');
}

/** Сколько участков связки человек забрал себе. Не номер шага. */
export function level(step: StepKey): number {
  return openChain(step).length;
}

/** Уровень как двузначная строка для приборной подписи: 01, 02, … */
export function levelLabel(step: StepKey): string {
  return String(level(step)).padStart(2, '0');
}

/** Максимум, достижимый в воронке. Нужен подписи «N из M». */
export const MAX_LEVEL = level(STEPS[STEPS.length - 1]);

/**
 * Открыта ли лаборатория. Не участок связки: это место, где учат, а не звено
 * пути человека. Открывается тестом — и до `video3` дверь закрыта.
 */
export function labUnlocked(step: StepKey): boolean {
  return stepIndex(step) >= stepIndex('video3');
}
