import { describe, expect, it } from 'vitest';
import { STEPS, stepIndex, type StepKey } from './router/flow';
import {
  ARTIFACTS,
  CHAIN,
  MAX_LEVEL,
  ZONES,
  labUnlocked,
  level,
  openChain,
  zoneState,
  type ZoneId,
  type ZoneState,
} from './world';

const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

/** Порядок состояний: участок может двигаться только вперёд. */
const ORDER: Record<ZoneState, number> = { fog: 0, shape: 1, known: 2, open: 3 };

describe('связка', () => {
  it('в начале у человека открыт только рекламный кабинет', () => {
    const first = STEPS[0];
    expect(zoneState('traffic', first)).toBe('open');
    for (const id of ZONE_IDS.filter((z) => z !== 'traffic')) {
      expect(zoneState(id, first)).not.toBe('open');
    }
  });

  /**
   * СТОРОЖ ПРОТИВ ОПЕЧАТКИ В РАСПИСАНИИ. `stepIndex()` возвращает -1 для шага,
   * которого нет в маршруте, а `reached()` считает -1 достигнутым всегда — и
   * участок молча открывается с нулевого шага. Именно так ломается карта при
   * переименовании шага. Проверка выше поймала бы это только для `traffic`,
   * поэтому здесь отдельно: ни один участок не может быть открыт до того, как
   * человек вообще что-либо прошёл.
   */
  it('ни один участок не открывается раньше своего шага', () => {
    for (const id of ZONE_IDS) {
      const opensAt = STEPS.findIndex((step) => zoneState(id, step) === 'open');
      if (opensAt === -1) continue;
      for (const step of STEPS.slice(0, opensAt)) {
        expect(zoneState(id, step)).not.toBe('open');
      }
    }
  });

  it('состояние участка не откатывается назад по маршруту', () => {
    for (const id of ZONE_IDS) {
      let seen = 0;
      for (const step of STEPS) {
        const now = ORDER[zoneState(id, step)];
        expect(now).toBeGreaterThanOrEqual(seen);
        seen = now;
      }
    }
  });

  /**
   * ЦЕНТРАЛЬНЫЙ ТЕЗИС ПРОДУКТА, ЗАКРЫТЫЙ ТЕСТОМ. Лид, квал и продажа не
   * становятся твоими никогда: ты контролируешь значительно большую часть пути
   * до денег, но не путь целиком. Открыть любой из них — начать врать, и это
   * должно ломать сборку, а не проходить ревью.
   */
  it('лид, квал и продажа не открываются ни на одном шаге', () => {
    for (const id of ZONE_IDS.filter((z) => !ZONES[z].attainable)) {
      for (const step of STEPS) {
        expect(zoneState(id, step)).not.toBe('open');
      }
    }
    expect(ZONE_IDS.filter((z) => !ZONES[z].attainable).sort()).toEqual([
      'lead',
      'qual',
      'sale',
    ]);
  });

  it('к финалу собраны ровно трафик и три детали связки', () => {
    const last = STEPS[STEPS.length - 1];
    expect(openChain(last)).toEqual(['traffic', ...ARTIFACTS]);
    expect(MAX_LEVEL).toBe(4);
    expect(level(last)).toBe(MAX_LEVEL);
  });

  it('каждая деталь связки встаёт ровно на своём шаге', () => {
    const opensAt = (id: ZoneId): StepKey =>
      STEPS.filter((s) => zoneState(id, s) === 'open')[0];

    expect(opensAt('audience')).toBe('audience');
    expect(opensAt('offer')).toBe('test');
    expect(opensAt('landing')).toBe('bundle');
  });

  it('порядок связки идёт от трафика к продаже', () => {
    expect(CHAIN[0]).toBe('traffic');
    expect(CHAIN[CHAIN.length - 1]).toBe('sale');
    expect(CHAIN).toHaveLength(ZONE_IDS.length);
  });
});

describe('лаборатория', () => {
  it('закрыта до третьей главы и открыта с неё', () => {
    for (const step of STEPS.slice(0, stepIndex('video3'))) {
      expect(labUnlocked(step)).toBe(false);
    }
    for (const step of STEPS.slice(stepIndex('video3'))) {
      expect(labUnlocked(step)).toBe(true);
    }
  });

  /**
   * Проверка стоит ПЕРЕД третьей главой, а не после неё. Если этот порядок
   * когда-нибудь поменяют, обещание «не пущу к производству, пока не разобрался»
   * перестанет выполняться, а сам тест превратится в формальность после факта.
   */
  it('проверка идёт до производства посадки', () => {
    expect(stepIndex('test')).toBeLessThan(stepIndex('video3'));
    expect(stepIndex('video2')).toBeLessThan(stepIndex('test'));
  });
});
