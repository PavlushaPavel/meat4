import { motion, useReducedMotion } from 'motion/react';
import { preframe } from '@/content/preframe';
import { voiceUi } from '@/content/scene';
import { calm, dur, lead, tween } from '@/scene/motion';
import type { VoiceRun } from '@/scene/useVoice';
import type { PreframeCue } from '@/content/preframe';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/CityStage';
import { LivingCity } from '@/ui/LivingCity';
import { VoiceMessage } from '@/ui/VoiceMessage';
import { Legend } from '@/ui/Plate';

/**
 * Первый экран воронки: город уже живёт, а посреди него лежит одно сообщение.
 *
 * ПОЧЕМУ НЕ AUTOPLAY. Нажатие решает сразу три задачи: это первый осмысленный
 * жест — человек САМ согласился слушать, а не получил внезапно орущий ролик;
 * это снятие браузерного запрета на звук без действия; и это ответ на вопрос
 * «что тут вообще делать» — вместо полутора минут текста, которые надо начать
 * читать без всякой причины (docs/SPEC.md §2.0).
 *
 * ПОЧЕМУ ГОРОД ЖИВЁТ ЗА ИНТЕРФЕЙСОМ, А НЕ РЯДОМ С НИМ. Мёртвый кадр читается
 * как заставка перед входом, а сюжет в кадре крадёт у голоса его работу. Нужен
 * именно фон, который дышит: тогда экран воспринимается как место, в котором
 * человек уже находится, и решение «слушать или нет» он принимает изнутри
 * города, а не с его обложки. Всё движение живёт в `LivingCity` и там же
 * выключается при `prefers-reduced-motion`.
 *
 * ПОЧЕМУ ПУЗЫРЬ ПО ЦЕНТРУ, А НЕ ВНИЗУ. Прижатый к нижней кромке, он означал бы
 * переписку — последнюю реплику в ленте, за которой была другая. Здесь ленты
 * нет: это ОДНО сообщение, ради которого человек сюда пришёл, и стоять оно
 * обязано там, куда смотрят, — в середине кадра.
 *
 * ПРЕТЕНЗИЙ КЛИЕНТА ЗДЕСЬ НЕТ, и это решение, а не потеря. Они звучат ВНУТРИ
 * записи (`preframe.claims`, такты `claim-*`) и показываются сценой в тот
 * момент, когда автор их произносит. Выложенные ещё и на вход, они превращали
 * первый экран в пересказ того, что человек через минуту услышит.
 */
export function VoiceIntro<Cue extends string = PreframeCue>({
  voice,
}: {
  voice: VoiceRun<Cue>;
}) {
  const reduceMotion = useReducedMotion();

  /**
   * ЧТО ЗА ЦИФРА СТОИТ В ПУЗЫРЕ.
   *
   * Пока записи нет, длину брать неоткуда — и приложение НЕ ИМЕЕТ ПРАВА её
   * придумать: выдуманный таймкод ничем не отличается от выдуманного CPL. Но и
   * прочерк здесь врал бы в другую сторону, потому что хронометраж известен —
   * его задал автор (`plannedDuration`). Появится файл — `duration` придёт из
   * самих метаданных и вытеснит объявленное значение. Цифра на экране всегда
   * либо настоящая, либо названная автором.
   *
   * Форматирует её `VoiceMessage`: часы в интерфейсе одни на весь проект.
   */
  const shown = voice.duration > 0 ? voice.duration : preframe.voice.plannedDuration;

  return (
    <div className="relative isolate h-dvh w-full overflow-hidden bg-tg-scene">
      <LivingCity file="city-1.webp" />

      {/*
        Затемнение поверх города — не настроение, а требование читаемости:
        под подписями идёт живой кадр с фарами и окнами, и без этого слоя
        контраст текста менялся бы вместе с картинкой. Середина светлее краёв:
        там лежит пузырь со своей заливкой, и гасить город под ним незачем.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,16,0.88)_0%,rgba(6,10,16,0.52)_32%,rgba(6,10,16,0.86)_62%,rgba(6,10,16,0.96)_100%)]"
      />

      {/*
        Экран ровно в высоту окна: страница расти не должна. Всё содержимое —
        одна группа по центру, а не колонка, растянутая по краям: заголовок,
        сообщение и действие читаются одним движением взгляда сверху вниз.
      */}
      <Screen className="relative h-full justify-center gap-5">
        {/*
          Кто говорит. Формулировка заказчика лежит в контенте: копирайта в
          разметке в этом проекте не бывает (docs/SPEC.md §5.1). Имя автора
          называет сам пузырь — здесь только повод открыть сообщение.
        */}
        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={calm(reduceMotion, tween(dur.base))}
          className="text-center font-display text-lg font-semibold text-ink"
        >
          {preframe.voice.title}
        </motion.h1>

        <VoiceMessage
          available={voice.available}
          playing={voice.playing}
          position={voice.position}
          duration={shown}
          rate={voice.rate}
          // Нажатие на кнопку пузыря и нажатие на действие внизу ведут в одно и
          // то же: у экрана один вход, просто две двери.
          onPrimary={voice.start}
          onSeek={voice.seek}
          onRate={voice.cycleRate}
          className="self-center"
        />

        {/*
          Главное действие экрана. Не «слушать», а обещание пути: человек
          соглашается не на полторы минуты звука, а на экскурсию по городу.
          Приезжает следом за пузырём — сначала сообщение, потом ответ на него.
          Ширина ровно как у пузыря: сообщение и ответ на него — одна колонка, и
          действие шире собственного сообщения выглядело бы приклеенным к экрану,
          а не к нему.
        */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={calm(reduceMotion, { ...tween(dur.base), delay: lead.cue })}
          className="flex w-[88%] flex-col items-center gap-2.5 self-center pt-1"
        >
          <Button onClick={voice.start}>{preframe.voice.cta}</Button>

          {/*
            Состояние записи — одной строкой и ровно один раз. В пузыре о нём
            говорят форма (пунктирная кромка, неподвижная полоса) и подпись
            кнопки для экранного диктора; продублированное словами дважды на
            одном экране, оно читалось бы как ошибка вёрстки, а не как честность.
          */}
          <Legend tone="dim" className="text-center">
            {voice.available ? voiceUi.invite : voiceUi.pending}
          </Legend>
        </motion.div>
      </Screen>
    </div>
  );
}
