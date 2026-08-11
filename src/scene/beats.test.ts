import { describe, expect, it } from 'vitest';
import { holdFor, sceneDuration, type Beat } from './beats';
import { preframeBeats, conversionBeats } from '@/content/preframe';
import { audienceScene } from '@/content/city';

/**
 * Сторож темпа сцен.
 *
 * ЗАЧЕМ. Длительность сцены не видна ни типам, ни линту, ни глазу при чтении
 * кода: она складывается из длины реплик и считается на лету. Дописать три
 * абзаца в префрейм и незаметно превратить минуту в две — вопрос одной правки
 * контента. Заказчик задал вход в город как 60–90 секунд, подъём в Conversion
 * District как 30–40, награду между главами как пятнадцать (docs/SPEC.md §2.1);
 * дальше это уже не «та же сцена, только длиннее», а другой продукт.
 *
 * Верхняя граница подъёма взята с запасом в пять секунд от присланных сорока:
 * ровное попадание в границу означало бы, что любая правка формулировки
 * роняет сборку, и текст начали бы подгонять под тест, а не наоборот.
 */

const SECOND = 1000;

function seconds(beats: readonly Beat<string>[]): number {
  return sceneDuration(beats) / SECOND;
}

describe('темп сцен', () => {
  it('вход в Traffic Town укладывается в 60–90 секунд', () => {
    expect(seconds(preframeBeats)).toBeGreaterThanOrEqual(60);
    expect(seconds(preframeBeats)).toBeLessThanOrEqual(90);
  });

  it('подъём в Conversion District укладывается в 30–45 секунд', () => {
    expect(seconds(conversionBeats)).toBeGreaterThanOrEqual(30);
    expect(seconds(conversionBeats)).toBeLessThanOrEqual(45);
  });

  it('награда между главами не длиннее пятнадцати секунд', () => {
    expect(seconds(audienceScene.beats)).toBeLessThanOrEqual(15);
  });
});

describe('такты', () => {
  const ALL: readonly (readonly Beat<string>[])[] = [
    preframeBeats,
    conversionBeats,
    audienceScene.beats,
  ];

  /**
   * Ключ такта — это ключ анимации в `AnimatePresence`. Два одинаковых внутри
   * одной сцены означают, что React переиспользует узел вместо смены кадра:
   * реплика поменяется, а картинка останется прежней. Визуально это выглядит
   * как «сцена подвисла», и найти причину по коду почти невозможно.
   */
  it('ключи тактов уникальны внутри своей сцены', () => {
    for (const scene of ALL) {
      const ids = scene.map((beat) => beat.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  /**
   * Ни один такт не должен висеть дольше семи секунд: это потолок `holdFor`, и
   * заданное руками время не имеет права его перешагивать. Дольше человек
   * решает, что приложение зависло, и уходит — тем более что кнопки на экране
   * в этот момент нет.
   */
  it('ни один такт не висит дольше семи секунд', () => {
    for (const scene of ALL) {
      for (const beat of scene) {
        expect(holdFor(beat)).toBeLessThanOrEqual(7000);
      }
    }
  });

  /** Молчащий такт допустим (говорит телефон), пустая сцена — нет. */
  it('в каждой сцене есть хотя бы одна реплика автора', () => {
    for (const scene of ALL) {
      expect(scene.some((beat) => beat.say.length > 0)).toBe(true);
    }
  });
});
