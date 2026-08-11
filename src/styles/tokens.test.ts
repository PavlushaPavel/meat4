import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Сторожевые тесты слоя стилей.
 *
 * Обе проверки закрывают ошибки, которые НЕ ВИДНЫ ни сборке, ни типам, ни
 * линту: всё остаётся зелёным, а мир на экране разваливается. Оба случая уже
 * происходили в этом проекте, поэтому проверяются байтами исходника.
 */

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

/**
 * Возвращает содержимое первого блока `@layer <name> { … }` с учётом вложенных
 * фигурных скобок. Регулярным выражением это не берётся: внутри слоя лежат
 * вложенные правила и медиазапросы.
 */
function layerBody(css: string, name: string): string {
  const start = css.indexOf(`@layer ${name} {`);
  if (start === -1) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
    }
  }
  return '';
}

describe('globals.css', () => {
  const css = read('./globals.css');

  /**
   * ЛОВУШКА TAILWIND 4. Незаслоённое правило (объявленное вне `@layer`)
   * выигрывает у ЛЮБЫХ заслоённых утилит независимо от специфичности. Если
   * универсальный сброс окажется снаружи `@layer base`, он обнулит все утилиты
   * отступов и заливок: `p-4`, `m-2`, `bg-scene` перестанут действовать. При
   * этом сборка, типы и линт останутся зелёными, а увидеть это можно только
   * через `getComputedStyle` в браузере.
   */
  it('универсальный сброс лежит ВНУТРИ @layer base', () => {
    const base = layerBody(css, 'base');

    expect(base).toContain('*,');
    expect(base).toContain('*::before');
    expect(base).toContain('*::after');

    // И его нет снаружи слоя: вырезаем слой и проверяем остаток.
    const outside = css.replace(base, '');
    expect(outside).not.toMatch(/^\s*\*,\s*$/m);
  });

  it('материал мира тоже заслоён — иначе он перебьёт утилиты', () => {
    const base = layerBody(css, 'base');
    for (const cls of ['.stage-grain', '.hazard-tape', '.metal-panel', '.paper-sheet']) {
      expect(base).toContain(cls);
    }
  });
});

describe('tokens.css', () => {
  const css = read('./tokens.css');
  const ACTS = ['city', 'study', 'lab'] as const;

  /**
   * ЛОВУШКА ДВОЙНОЙ КОСВЕННОСТИ. Нельзя объявить `--color-scene: var(--act-scene)`
   * один раз в `@theme` и переопределять на актах только `--act-scene`:
   * значение кастомного свойства подставляется там, где оно САМО объявлено, а
   * не там, где его использует утилита. Сцена молча останется одного цвета на
   * всю воронку. Поэтому каждый акт обязан объявлять семантические имена сам.
   */
  it.each(ACTS)('акт %s объявляет семантические цвета напрямую', (act) => {
    const block = css.slice(css.indexOf(`[data-act='${act}']`));
    const body = block.slice(block.indexOf('{') + 1, block.indexOf('}'));

    for (const token of ['--color-scene', '--color-ink', '--color-line', '--color-glow']) {
      expect(body).toContain(`${token}:`);
    }
    // Ни одного значения через промежуточное имя.
    expect(body).not.toMatch(/--color-[a-z-]+:\s*var\(/);
  });

  it('у каждого акта свой фон сцены — иначе переключать было бы нечего', () => {
    const scenes = ACTS.map((act) => {
      const block = css.slice(css.indexOf(`[data-act='${act}']`));
      const body = block.slice(block.indexOf('{') + 1, block.indexOf('}'));
      return /--color-scene:\s*([^;]+);/.exec(body)?.[1].trim();
    });

    expect(new Set(scenes).size).toBe(ACTS.length);
  });
});
