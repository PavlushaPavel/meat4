import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { holdFor, type Beat } from './beats';
import type { BeatRun } from './useBeats';

/**
 * Сцена, которую ведёт голос автора.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ХУК, А НЕ ФЛАГ В `useBeats`. У сцены с записью и у сцены с
 * таймером разные хозяева времени. В первой ведущий — звук: город обязан
 * меняться там, где произнесена фраза, и обязан слушаться перемотки, паузы и
 * ускорения. Во второй ведущий — расчёт по длине текста. Смешать это в одном
 * хуке значило бы получить два состояния истины о том, «какой сейчас такт».
 *
 * ОБА РЕЖИМА ОТДАЮТ ОДИН И ТОТ ЖЕ `BeatRun`, поэтому сцене всё равно, кто её
 * ведёт: она получает индекс, лог и «договорил». Это и позволяет держать
 * честное состояние — записи пока нет, и воронка идёт по таймеру, ничего не
 * зная о голосе.
 */

export interface VoiceRun<Cue extends string> {
  /** То же, что отдаёт `useBeats`: сцене безразлично, кто её ведёт. */
  run: BeatRun<Cue>;

  /** Запись подключена. Ложь — работает таймер, а плеера на экране быть не должно. */
  available: boolean;
  /** Человек нажал воспроизведение хотя бы раз: вступление пройдено. */
  started: boolean;
  playing: boolean;
  /** Секунда записи и её длина. Ноль, пока метаданные не загрузились. */
  position: number;
  duration: number;
  /** Скорость: 1, 1.5, 2 — как в мессенджере. */
  rate: number;

  /** Запустить. Обязан вызываться из жеста человека: иначе браузер не даст звук. */
  start: () => void;
  toggle: () => void;
  cycleRate: () => void;
  /** Перемотка по полосе, 0…1. */
  seek: (ratio: number) => void;
}

const RATES = [1, 1.5, 2] as const;

export function useVoice<Cue extends string>(
  beats: readonly Beat<Cue>[],
  src: string,
): VoiceRun<Cue> {
  const reduceMotion = useReducedMotion();
  const audio = useRef<HTMLAudioElement | null>(null);
  const last = beats.length - 1;

  const available = src !== '';
  /**
   * Метки времени есть у всех тактов или ни у одного. Половина расставленных
   * меток хуже, чем ни одной: часть сцены шла бы за голосом, часть за
   * таймером, и рассинхрон было бы невозможно объяснить.
   */
  const timed = useMemo(() => beats.every((b) => typeof b.at === 'number'), [beats]);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(RATES[0]);

  /**
   * При `prefers-reduced-motion` сцена не проигрывается: человек сразу получает
   * весь текст и кнопку. Значит и кадр обязан быть ПОСЛЕДНИМ, а не первым —
   * иначе под полным логом стоит первая картинка вступления, и это выглядит как
   * подвисшая сцена. В `useBeats` то же место сделано так же.
   */
  const [index, setIndex] = useState(() => (reduceMotion ? last : 0));
  const [done, setDone] = useState(() => Boolean(reduceMotion));

  // --- Ведёт таймер: записи нет либо метки не расставлены -------------------

  const indexRef = useRef(index);
  indexRef.current = index;

  const advance = useCallback(() => {
    if (indexRef.current >= last) {
      setDone(true);
      return;
    }
    setIndex((i) => Math.min(last, i + 1));
  }, [last]);

  const byTimer = !available || !timed;

  useEffect(() => {
    if (!byTimer || !started || done || reduceMotion) return;
    const timer = window.setTimeout(advance, holdFor(beats[index]));
    return () => window.clearTimeout(timer);
  }, [advance, beats, byTimer, done, index, reduceMotion, started]);

  // --- Ведёт голос ---------------------------------------------------------

  useEffect(() => {
    if (!available) return;
    const el = new Audio(src);
    el.preload = 'metadata';
    audio.current = el;

    const onMeta = () => setDuration(el.duration || 0);
    const onTime = () => {
      setPosition(el.currentTime);
      if (!timed) return;
      // Индекс — это не «следующий такт», а функция позиции в записи. Иначе
      // перемотка назад оставила бы город на месте, а вперёд — потеряла кадры.
      let next = 0;
      for (let i = 0; i < beats.length; i += 1) {
        if (el.currentTime >= (beats[i].at ?? 0)) next = i;
      }
      setIndex(next);
    };
    const onEnd = () => {
      setPlaying(false);
      setIndex(last);
      setDone(true);
    };

    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.pause();
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      audio.current = null;
    };
  }, [available, beats, last, src, timed]);

  const start = useCallback(() => {
    setStarted(true);
    const el = audio.current;
    if (!el) return;
    el.playbackRate = rate;
    // Промах здесь не должен ломать воронку: не дали звук — сцена всё равно
    // идёт, просто молча (docs/SPEC.md §3.7).
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [rate]);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const cycleRate = useCallback(() => {
    setRate((current) => {
      const next = RATES[(RATES.indexOf(current as 1) + 1) % RATES.length];
      if (audio.current) audio.current.playbackRate = next;
      return next;
    });
  }, []);

  const seek = useCallback((ratio: number) => {
    const el = audio.current;
    if (!el || !el.duration) return;
    el.currentTime = Math.max(0, Math.min(1, ratio)) * el.duration;
  }, []);

  /** Развернуть сцену целиком и оборвать запись: человек читает быстрее. */
  const finish = useCallback(() => {
    audio.current?.pause();
    setPlaying(false);
    setIndex(last);
    setDone(true);
  }, [last]);

  const run: BeatRun<Cue> = {
    index,
    current: beats[index],
    said: reduceMotion ? beats : beats.slice(0, index + 1),
    done: done || Boolean(reduceMotion),
    advance,
    finish,
  };

  return {
    run,
    available,
    started,
    playing,
    position,
    duration,
    rate,
    start,
    toggle,
    cycleRate,
    seek,
  };
}
