import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import App from '@/App';
import { useFunnel } from '@/store/funnel';
import { STEPS } from '@/router/flow';
import { preframe, preframeBeats, conversion } from '@/content/preframe';
import { LESSONS, LESSON_UI } from '@/content/lessons';
import { audienceScene, bundleFinale } from '@/content/city';
import { quizBank, quizCopy, LIVES } from '@/content/quiz';
import { sceneUi } from '@/content/scene';
import { ZONES } from '@/world';

/**
 * ГЛАВНЫЙ СТОРОЖ ПРОЕКТА.
 *
 * Он ходит по воронке кнопками, как человек, при ПОЛНОСТЬЮ ПУСТОМ окружении:
 * видео не сняты, ассистентов нет, сайта-доказательства нет, оплата не
 * подключена. Ровно в таком виде воронка выложена людям, и она обязана
 * доводить до цены (docs/SPEC.md §3.7).
 *
 * ПОЧЕМУ ЭТО НЕ ЗАМЕНЯЕТСЯ ТЕСТАМИ ОТДЕЛЬНЫХ ЭКРАНОВ. Каждый экран по
 * отдельности можно сделать зелёным и всё равно получить воронку, которая
 * упирается в неактивную кнопку и никуда не ведёт. Тупик — это свойство
 * МАРШРУТА, а не экрана, и виден он только при сквозном проходе.
 *
 * ЗАПРЕЩЕНО делать этот тест «мягче»: заменять поиск кнопки на прямую установку
 * шага в сторе, ловить исключения, проверять `toBeTruthy()` вместо конкретного
 * текста. Тест, который проходит на сломанной воронке, хуже отсутствующего.
 */

/** Нажать кнопку с этим текстом. Падает, если её нет, — так и задумано. */
async function press(label: string | RegExp) {
  const button = await screen.findByRole('button', { name: label });
  await act(async () => {
    button.click();
  });
}

/**
 * Развернуть сцену целиком, не дожидаясь таймеров.
 *
 * Сцены идут сами, такт за тактом, и суммарно это больше минуты. Ждать её в
 * тесте реальным временем нельзя, поэтому жмём «пропустить» — тот же путь, что
 * у человека, который читает быстрее. Проверка самих таймеров — не здесь:
 * длительности считает `sceneDuration`, у него свой тест.
 */
async function skipScene() {
  await press(SKIP_LABEL);
}

/** Подпись «пропустить» одна на все сцены и живёт в контенте. */
const SKIP_LABEL = sceneUi.skip;

/**
 * Найти вопрос, который сейчас на экране.
 *
 * Порядок вопросов перемешивается при каждом прогоне, поэтому тест не может
 * знать его заранее — он опознаёт вопрос по тексту и берёт верный ответ из
 * банка. Ждать приходится потому, что карточка меняется через анимацию выхода:
 * между старым вопросом и новым есть кадр, в котором на экране нет ни одного.
 */
async function findCurrentQuestion() {
  let found: (typeof quizBank)[number] | undefined;
  await waitFor(() => {
    found = quizBank.find((q) => screen.queryByText(q.question) !== null);
    if (!found) {
      throw new Error(
        `На экране нет ни одного вопроса из банка. Показано: ${document.body.textContent?.slice(0, 200)}`,
      );
    }
  });
  return found!;
}

/** Ответить на текущий вопрос проверки верно и уйти к следующему. */
async function answerCorrectly() {
  const question = await findCurrentQuestion();
  const right = question.options.find((o) => o.id === question.correctId);
  if (!right) throw new Error(`У вопроса ${question.id} нет верного варианта`);

  await press(new RegExp(escapeRegExp(right.text)));
  await press(quizCopy.verdict.next);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('воронка при пустом окружении', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  it('проходится целиком: от сообщения клиента до цены', async () => {
    render(<App />);

    // --- Шаг 1. Префрейм: сообщение клиента и отъезд камеры ---
    /**
     * Подсказка про тап обязана быть на экране С ПЕРВОГО КАДРА. Сцена идёт
     * сама и кнопок не показывает: без этой строки человек не может узнать,
     * что темп в его руках, а догадаться неоткуда.
     */
    expect(screen.getByText(sceneUi.tapHint)).toBeTruthy();

    // Первый такт — уведомление с «печатает…»; текст целиком человек видит
    // тактом позже. Тап делает ровно то же, что сделало бы ожидание таймера.
    await press(sceneUi.tapAria);
    expect(await screen.findByText(preframe.message.text)).toBeTruthy();
    await skipScene();
    await press(preframe.cta);

    // --- Шаг 2. Подъём в Conversion District ---
    expect(useFunnel.getState().step).toBe('conversion');
    await skipScene();
    await press(conversion.cta);

    // --- Шаг 3. Глава 01: аудитория ---
    expect(await screen.findByText(LESSONS.video1.title)).toBeTruthy();
    // Видео нет — и человек обязан это увидеть, а не смотреть в пустоту.
    expect(await screen.findByText(LESSON_UI.videoPending)).toBeTruthy();
    await press(LESSONS.video1.next);

    // --- Шаг 4. Пятнадцать секунд города: деталь встала на место ---
    expect(useFunnel.getState().step).toBe('audience');
    await skipScene();
    // Деталь собрана до перехода дальше, а не «как-нибудь потом».
    expect(useFunnel.getState().artifacts).toContain('audience');
    await press(audienceScene.cta);

    // --- Шаг 5. Глава 02: оффер ---
    expect(await screen.findByText(LESSONS.video2.title)).toBeTruthy();
    await press(LESSONS.video2.next);

    // --- Шаг 6. Проверка: двенадцать вопросов без единой ошибки ---
    expect(useFunnel.getState().step).toBe('test');
    await press(quizCopy.gate.cta);
    for (let i = 0; i < quizBank.length; i += 1) {
      await answerCorrectly();
    }
    expect(useFunnel.getState().passed).toBe(true);
    expect(useFunnel.getState().lives).toBe(LIVES);
    await press(new RegExp(escapeRegExp(quizCopy.passed.cta)));

    // --- Шаг 7. Глава 03: посадка ---
    expect(await screen.findByText(LESSONS.video3.title)).toBeTruthy();
    await press(LESSONS.video3.next);

    // --- Шаг 8. Связка собрана ---
    expect(useFunnel.getState().step).toBe('bundle');
    expect(await screen.findByText(bundleFinale.status)).toBeTruthy();

    /**
     * ЗДЕСЬ ЖИЛ БЫ ТУПИК. Сайта-доказательства ещё не существует, и если бы
     * цена открывалась только по кнопке «Потыкать сайт», воронка при пустом
     * окружении не доводила бы до продажи вообще. Честная альтернатива обязана
     * быть нажимаемой.
     */
    await press(bundleFinale.proof.missing);
    expect(await screen.findByText(bundleFinale.product.price)).toBeTruthy();

    // И это действительно конец маршрута, а не остановка посередине.
    expect(useFunnel.getState().step).toBe(STEPS[STEPS.length - 1]);
  }, 30_000);
});

describe('подсказка про тап', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  /**
   * Подсказка учит ОДНОМУ жесту и обязана уйти. Оставшись до конца сцены, она
   * из помощи превращается в мигающую строку поверх рассказа — а рассказ здесь
   * и есть продукт. Проверяется поведение, а не число тактов: сколько именно их
   * держать, решает `HINT_BEATS`, и менять его можно свободно.
   */
  it('исчезает, когда жест уже понят', async () => {
    render(<App />);
    expect(screen.getByText(sceneUi.tapHint)).toBeTruthy();

    /**
     * Три такта — заведомо больше, чем держится подсказка, и заведомо меньше
     * пятнадцати тактов сцены. Опрашивать её присутствие в цикле нельзя:
     * подсказка уходит с анимацией и ещё живёт в разметке, пока та идёт, —
     * цикл успел бы протапать всю сцену и «доказать», что она не исчезает.
     */
    for (let i = 0; i < 3; i += 1) await press(sceneUi.tapAria);
    await waitFor(() => expect(screen.queryByText(sceneUi.tapHint)).toBeNull());

    // И ушла она посреди рассказа, а не вместе с его концом: сцена ещё идёт,
    // главного действия на экране пока нет.
    expect(screen.queryByRole('button', { name: preframe.cta })).toBeNull();
    expect(preframeBeats.length).toBeGreaterThan(3);
  });
});

describe('ошибка в проверке', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  /**
   * Ошибка обязана СТОИТЬ жизнь и ОБЪЯСНЯТЬ решение, а не просто подсветить
   * неверный вариант. Иначе проверка превращается в формальность, которую
   * прокликивают, и весь её смысл — «не пущу к производству, пока не
   * разобрался» — исчезает.
   */
  it('снимает жизнь и показывает разбор', async () => {
    useFunnel.setState({ step: 'test' });
    render(<App />);
    await press(quizCopy.gate.cta);

    const question = await findCurrentQuestion();
    const wrong = question.options.find((o) => o.id !== question.correctId);
    if (!wrong) throw new Error(`У вопроса ${question.id} только один вариант`);

    await press(new RegExp(escapeRegExp(wrong.text)));

    expect(useFunnel.getState().lives).toBe(LIVES - 1);
    expect(await screen.findByText(question.explanation)).toBeTruthy();
  });

  /**
   * Кнопка пересмотра НЕ ПОКАЗЫВАЕТ ВРЕМЯ, пока записей не существует.
   * Выдуманный таймкод на несуществующем видео — ложь, и заметить её можно
   * только здесь: типы такую подмену пропускают (docs/SPEC.md §3.6).
   */
  it('не обещает таймкод, которого нет', () => {
    for (const question of quizBank) {
      expect(question.reviewAt).toBeNull();
    }
  });
});

describe('честность карты', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  /**
   * Центральный тезис продукта на самом видном экране: в финале, когда всё
   * собрано, лид, квал и продажа обязаны остаться чужими. `world.test.ts`
   * проверяет это на данных, здесь — на том, что реально показано человеку.
   */
  it('в финале лид, квал и продажа названы, но не твои', () => {
    useFunnel.setState({ step: 'bundle', artifacts: ['audience', 'offer', 'landing'] });
    render(<App />);

    for (const id of ['lead', 'qual', 'sale'] as const) {
      const row = screen.getAllByText(ZONES[id].name)[0];
      expect(row).toBeTruthy();
      // Открытый участок помечается галочкой — у чужих её быть не может.
      expect(within(row.closest('div') as HTMLElement).queryByText('✓')).toBeNull();
    }
  });
});
