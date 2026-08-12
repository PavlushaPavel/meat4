import { motion, useReducedMotion } from 'motion/react';
import { preframe } from '@/content/preframe';
import { voiceUi } from '@/content/scene';
import { calm, dur, lead, tween } from '@/scene/motion';
import type { VoiceRun } from '@/scene/useVoice';
import type { PreframeCue } from '@/content/preframe';
import { Screen } from '@/ui/CityStage';
import { VoiceMessage } from '@/ui/VoiceMessage';
import { Legend } from '@/ui/Plate';

/**
 * Первый экран воронки: переписка с клиентом и пришедшее голосовое.
 *
 * ПОЧЕМУ ВОРОНКА НАЧИНАЕТСЯ ИМЕННО ТАК. Вступление написано под произнесение:
 * короткие фразы, второе лицо, разговорный ритм. Прочитанное молча, оно
 * превращается в список тезисов — человеку СООБЩАЮТ то, что должно было стать
 * узнаванием. Голос возвращает тексту его носитель.
 *
 * А нажатие на воспроизведение решает сразу три задачи: это первый осмысленный
 * жест (человек соглашается слушать), это снятие браузерного запрета на звук
 * без действия, и это ответ на вопрос «а что тут вообще делать» — вместо
 * полутора минут текста, которые надо начать читать без всякой причины.
 *
 * МИР ЗДЕСЬ ВЫКЛЮЧЕН НАМЕРЕННО. Ни неона, ни металла, ни зерна: это настоящая
 * переписка, а не декорация под неё. То же решение, что и на экране клиента
 * дальше по воронке (docs/SPEC.md §3.3). Город включится ровно тогда, когда
 * зазвучит голос.
 */
export function VoiceIntro<Cue extends string = PreframeCue>({
  voice,
}: {
  voice: VoiceRun<Cue>;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Screen className="min-h-dvh justify-end gap-3 bg-tg-scene pb-10">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={calm(reduceMotion, tween(dur.base))}
        className="flex w-full max-w-[88%] flex-col gap-1 rounded-panel bg-tg-in px-3.5 py-3"
      >
        <span className="legend text-tg-dim">{preframe.message.sender}</span>
        <p className="text-base leading-relaxed text-tg-ink">{preframe.message.text}</p>
      </motion.div>

      {/*
        Голосовое приходит следом за претензией клиента, а не вместо неё:
        сначала человек узнаёт свою ситуацию, и только потом кто-то предлагает
        про неё поговорить. Обратный порядок сделал бы автора навязчивым.
      */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={calm(reduceMotion, { ...tween(dur.base), delay: lead.cue })}
      >
        <VoiceMessage
          available={voice.available}
          playing={voice.playing}
          position={voice.position}
          duration={voice.duration}
          rate={voice.rate}
          onPrimary={voice.start}
          onSeek={voice.seek}
          onRate={voice.cycleRate}
        />
      </motion.div>

      {/*
        Одна строка под перепиской: приглашение, когда запись есть, и честная
        причина, когда её нет. Прижато к низу вместе с сообщениями — так стоит
        любой мессенджер, и человек узнаёт форму раньше, чем читает текст.
      */}
      <Legend tone="dim" className="self-center pt-1">
        {voice.available ? voiceUi.invite : voiceUi.pending}
      </Legend>
    </Screen>
  );
}
