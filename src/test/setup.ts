/**
 * Общий setup для vitest (подключается через `test.setupFiles` в
 * vite.config.ts), выполняется один раз для каждого тестового файла.
 *
 * Здесь только ПРОБЕЛЫ СРЕДЫ — то, чего нет в jsdom, но есть в любом браузере.
 * Обходить ими поведение прикладного кода запрещено: если тест падает из-за
 * логики, чинится логика, а не этот файл.
 */

/** jsdom не реализует `matchMedia`. Его спрашивают все проверки движения. */
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * jsdom не реализует прокрутку. `Element.prototype.scrollTo` вызывает лента
 * чата, `window.scrollTo` — оболочка при смене шага (src/App.tsx).
 */
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function scrollTo(): void {
    // no-op: реальная прокрутка в jsdom не нужна, важно только не бросать.
  };
}

window.scrollTo = function scrollTo(): void {
  // no-op по той же причине. Заменяется безусловно: в jsdom эта функция
  // существует, но при вызове печатает «Not implemented» в stderr на каждый
  // переход — двадцать пять строк шума за один прогон воронки.
};
