import { ARTIFACT_NOTE, CHAPTERS, LESSON_UI } from '@/content/lessons';
import type { Block, LessonContent } from '@/content/types';
import { stepIndex, type StepKey } from '@/router/flow';
import { useNav } from '@/router/useNav';
import { ArtifactPanel } from '@/ui/ArtifactPanel';
import { Blocks } from '@/ui/Blocks';
import { Button } from '@/ui/Button';
import { ChapterRail } from '@/ui/ChapterRail';
import { Screen } from '@/ui/CityStage';
import { VideoFrame } from '@/ui/VideoFrame';

/**
 * Экран главы обучения. Один на все три главы: они отличаются только текстом.
 *
 * ЗАЧЕМ ЭТОТ ЭКРАН ВЫГЛЯДИТ НЕ КАК ОСТАЛЬНАЯ ВОРОНКА. Требование заказчика
 * дословно: «Вот здесь я бы вообще перестал развлекать человека интерфейсом.
 * Нормальный удобный экран обучения. Видео занимает большую часть экрана.
 * Сверху небольшой прогресс». Акт `study` намеренно выпадает из мира — как
 * выпадает экран мессенджера (docs/SPEC.md §3.3): человек сел смотреть
 * обучение, и ночной город за плеером тут мешает, а не помогает. Фонового
 * кадра у этих шагов нет, и это решение, а не пропуск (`CityStage`).
 *
 * ПОРЯДОК ЭКРАНА СВЕРХУ ВНИЗ И ПОЧЕМУ ИМЕННО ТАКОЙ:
 *
 *  1. полоса глав — «сверху небольшой прогресс», три слова и стрелки;
 *  2. плеер во всю ширину — он идёт ДО заголовка, потому что заказчик просил
 *     не страницу с текстом и видео где-то внизу, а видео;
 *  3. номер, имя главы, подзаголовок;
 *  4. что уже лежит в проекте — сразу под шапкой, до чтения;
 *  5. конспект на бумаге: вступление автора и разделы главы;
 *  6. результат главы — предмет, который человек уносит дальше;
 *  7. одно действие.
 *
 * ПОЧЕМУ КОНСПЕКТ НА БУМАГЕ. Это единственная светлая поверхность мира и
 * единственное место длинного чтения (docs/SPEC.md §5.5): километр текста
 * светлым по тёмному с телефона не читается. Лист здесь ровный, без шапки
 * протокола и без наклона `Printout` — сценический реквизит в акте обучения
 * запрещён, а материал остаётся тем же.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: неона, металла, жёлтой ленты, врезки автора с неоновой
 * кромкой и любого второго индикатора прогресса. Единственное движение на
 * экране — полоса развёртки в пустом плеере.
 *
 * ТОКЕНЫ. `[data-act='study']` в `src/styles/tokens.css` пока не объявлен, и
 * экран сознательно построен так, что это не поломка: он пользуется только
 * семантическими именами (`scene`, `scene-deep`, `ink`, `ink-dim`, `line`,
 * `paper*`), а без своего блока они берутся из `@theme`. Если акту всё же
 * заведут собственные значения, ждём от них ровно одного: тише и нейтральнее
 * города — фон чуть светлее `#0a0b09` и без зелёного отлива, `--color-glow`
 * приглушённый (свет сверху над плеером не должен отдавать неоном), зерно
 * около 0.03 и виньетка около 0.5. Ничего другого этот экран не читает.
 */
export function LessonScreen({
  content,
  startAt = null,
}: {
  content: LessonContent;
  /**
   * Секунда, с которой начать запись. Пробрасывается насквозь в плеер: когда
   * появятся видео, пересмотр после ошибки в тесте вернёт человека в нужный
   * момент, а не в начало главы (`QuizQuestion.reviewAt`).
   */
  startAt?: number | null;
}) {
  const { step, next, reviewing } = useNav();

  /**
   * Пройденные главы считаются по МАРШРУТУ, а не по флагам в хранилище: любой
   * флаг можно забыть выставить, а порядок шагов забыть нельзя. Побочный
   * эффект осознанный — во время пересмотра после провала теста следующие
   * главы снова показываются непройденными: человек буквально вернулся назад.
   */
  const here = stepIndex(step);
  const done: StepKey[] = CHAPTERS.map((c) => c.step).filter(
    (chapterStep) => stepIndex(chapterStep) < here,
  );

  // Нижний отступ и безопасные зоны Telegram у `Screen` свои — здесь только
  // расстояние между блоками главы.
  return (
    <Screen className="gap-6">
      <ChapterRail
        chapters={CHAPTERS}
        current={step}
        done={done}
        ariaLabel={LESSON_UI.railAria}
        doneLabel={LESSON_UI.railDone}
      />

      {/*
        Плеер выходит за поля колонки: на телефоне запись занимает всю ширину
        экрана, а не колонку с отступами. Это и есть «видео занимает большую
        часть экрана» в вертикальном мини-аппе.
      */}
      <VideoFrame
        envVar={content.envVar}
        title={content.title}
        pending={LESSON_UI.videoPending}
        pendingHint={LESSON_UI.videoPendingHint}
        startAt={startAt}
        className="-mx-5 border-y border-line sm:mx-0 sm:rounded-panel sm:border"
      />

      <header className="space-y-2">
        <p className="legend text-ink-dim">
          {LESSON_UI.chapter} {content.number}
        </p>
        <h1 className="font-display text-title font-semibold uppercase leading-tight tracking-tight text-ink">
          {content.title}
        </h1>
        <p className="text-lead leading-snug text-ink-dim">{content.standfirst}</p>
      </header>

      {content.carried.length > 0 && (
        <ArtifactPanel
          variant="carried"
          caption={LESSON_UI.carried}
          lines={content.carried}
        />
      )}

      {/*
        Лист конспекта. `font-body text-paper-ink` объявлены здесь, потому что
        `Blocks` рассчитывает на бумагу под собой и красит только акценты.
      */}
      <article className="paper-sheet rounded-plate px-5 py-6 font-body text-paper-ink">
        <Blocks blocks={content.intro} />

        <p className="legend mt-8 border-t border-dashed border-paper-line pt-4 text-paper-ink-dim">
          {LESSON_UI.outline}
        </p>

        <div className="mt-4 space-y-7">
          {content.outline.map((section) => (
            <section key={section.title}>
              {/*
                Раздел с ассистентом помечен в конспекте намеренно: первый
                AI-wow происходит ВНУТРИ записи, и человек должен видеть в
                оглавлении, что он там есть. Ради него и досматривают.
              */}
              {section.ai && (
                <p className="legend mb-1 text-paper-ink-dim">{LESSON_UI.aiMark}</p>
              )}
              <Blocks blocks={sectionBlocks(section.title, section.items)} />
            </section>
          ))}
        </div>
      </article>

      <ArtifactPanel
        variant="output"
        caption={LESSON_UI.output}
        title={content.output.name}
        lines={content.output.lines}
        note={ARTIFACT_NOTE[content.output.id]}
        action={content.output.action}
      />

      {/*
        Одно действие на экране. Подпись берётся из главы, но при пересмотре
        после провала проверки она врала бы: `useNav()` в этом случае вернёт
        человека в тест, а не поведёт вперёд по маршруту.
      */}
      <Button onClick={next}>
        {reviewing ? LESSON_UI.backToTest : content.next}
      </Button>
    </Screen>
  );
}

/**
 * Раздел конспекта — это подзаголовок и перечисление, то есть ровно те же два
 * блока длинного чтения. Собираем их здесь и отдаём `Blocks`, чтобы разделы
 * набирались тем же кеглем и тем же ритмом, что и вступление автора: своя
 * вёрстка списка рано или поздно разошлась бы с общей.
 */
function sectionBlocks(title: string, items: readonly string[]): Block[] {
  return [
    { kind: 'h', text: title },
    { kind: 'list', items: [...items] },
  ];
}
