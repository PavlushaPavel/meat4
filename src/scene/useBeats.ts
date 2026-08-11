import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { holdFor, type Beat } from './beats';

export interface BeatRun<Cue extends string> {
  /** Индекс текущего такта. */
  index: number;
  /** Текущий такт — то, что сейчас говорится и показывается. */
  current: Beat<Cue>;
  /** Всё, что уже сказано, включая текущее. Лог не обрезается. */
  said: readonly Beat<Cue>[];
  /** Сцена договорила: пора показать кнопку. */
  done: boolean;
  /** Перейти к следующему такту немедленно (тап по сцене). */
  advance: () => void;
  /** Показать сцену целиком и договорить. Кнопка «пропустить». */
  finish: () => void;
}

/**
 * Проигрывание сцены по тактам.
 *
 * УПРАВЛЕНИЕ. Сцена идёт сама, но человек не заперт в её темпе: тап переводит
 * на следующий такт, «пропустить» разворачивает всю сцену сразу. Это не
 * «дальше» после каждой мысли — по умолчанию не надо нажимать ничего.
 *
 * `prefers-reduced-motion`. Сцена не проигрывается вовсе: человек сразу видит
 * весь текст и кнопку. Показывать анимацию медленнее или без движения было бы
 * половинчатым решением — тот, кто просил не двигать экран, просил и не ждать.
 *
 * ТАЙМЕР ПЕРЕЗАПУСКАЕТСЯ ОТ `index`, а не крутится один на всю сцену: иначе
 * ручной тап сбивал бы расписание, и следующий такт улетал бы через остаток
 * времени предыдущего.
 */
export function useBeats<Cue extends string>(beats: readonly Beat<Cue>[]): BeatRun<Cue> {
  const reduceMotion = useReducedMotion();
  const last = beats.length - 1;

  const [index, setIndex] = useState(() => (reduceMotion ? last : 0));
  const [done, setDone] = useState(() => Boolean(reduceMotion));

  // Живое значение для таймера: колбэк создаётся один раз на такт, а читать
  // ему нужно актуальный индекс.
  const indexRef = useRef(index);
  indexRef.current = index;

  const advance = useCallback(() => {
    if (indexRef.current >= last) {
      setDone(true);
      return;
    }
    setIndex((i) => Math.min(last, i + 1));
  }, [last]);

  const finish = useCallback(() => {
    setIndex(last);
    setDone(true);
  }, [last]);

  useEffect(() => {
    if (done || reduceMotion) return;
    const timer = window.setTimeout(advance, holdFor(beats[index]));
    return () => window.clearTimeout(timer);
  }, [advance, beats, done, index, reduceMotion]);

  return {
    index,
    current: beats[index],
    said: reduceMotion ? beats : beats.slice(0, index + 1),
    done,
    advance,
    finish,
  };
}
