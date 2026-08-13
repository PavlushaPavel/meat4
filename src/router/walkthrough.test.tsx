import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import App from '@/App';
import { useFunnel } from '@/store/funnel';
import { STEPS } from '@/router/flow';
import { preframe, preframeBeats, conversion } from '@/content/preframe';
import { LESSONS, LESSON_UI } from '@/content/lessons';
import { audienceScene, bundleFinale } from '@/content/city';
import { quizBank, quizCopy, LIVES } from '@/content/quiz';
import { playerUi, sceneUi } from '@/content/scene';
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
 * Начать рассказ.
 *
 * ОТДЕЛЬНОГО ЭКРАНА ВХОДА БОЛЬШЕ НЕТ: первый кадр — уже сцена, но она стоит,
 * пока человек не согласился слушать. Согласие даётся одним из двух способов —
 * главным действием внизу или кнопкой воспроизведения на карточке голосового.
 * Здесь жмём главное действие: это тот же путь, которым пойдёт человек.
 */
async function enterScene() {
  await press(preframe.voice.cta);
}

/**
 * Перевести рассказ на следующий такт.
 *
 * Пузырь гида внизу — единственный видимый орган управления сценой и он же
 * клавиатурный эквивалент тапа по афише. Нажатие на него делает ровно то же,
 * что сделало бы ожидание таймера.
 */
async function nextBeat() {
  await press(sceneUi.tapHint);
}

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

    // --- Вход: первый кадр это уже город, но рассказ ждёт согласия ---
    /**
     * Первая реплика на экране с самого начала — она часть афиши, а не
     * результат нажатия. А вот рассказ стоит: продолжения на экране нет, пока
     * человек не нажал.
     */
    expect(screen.getByText(preframeBeats[0].say[0])).toBeTruthy();
    expect(screen.queryByRole('button', { name: sceneUi.tapHint })).toBeNull();
    await enterScene();

    // --- Шаг 1. Префрейм: город, кабинет и претензии клиента ---
    /**
     * Пузырь-продолжение обязан быть на экране С ПЕРВОГО ЖЕ ТАКТА. Сцена идёт
     * сама, но темп в руках человека, и без единственного видимого органа
     * управления догадаться об этом неоткуда.
     */
    expect(await screen.findByRole('button', { name: sceneUi.tapHint })).toBeTruthy();

    /**
     * Претензия клиента обязана прийти В ВИТРИНУ, а не только заголовком.
     * Автор произносит её как чужую речь, и весь смысл такта в том, что человек
     * узнаёт СВОЮ переписку: пузырь мессенджера поверх города. Поэтому текст
     * ищется дважды — пузырём в кадре и репликой в тексте; одного вхождения
     * достаточно, чтобы кадр молча перестал показывать претензию.
     *
     * Номер такта не зашит: сценарий правится текстом, и такт с первой
     * претензией опознаётся по ней самой.
     */
    const firstClaim = preframeBeats.findIndex((b) => b.say[0] === preframe.claims[0]);
    expect(firstClaim).toBeGreaterThan(0);
    for (let i = 0; i < firstClaim; i += 1) await nextBeat();
    await waitFor(() => expect(screen.getAllByText(preframe.claims[0]).length).toBe(2));
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

describe('продолжение рассказа', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  /**
   * ПУЗЫРЬ ГИДА — ЕДИНСТВЕННЫЙ ВИДИМЫЙ ОРГАН УПРАВЛЕНИЯ РАССКАЗОМ, и он обязан
   * стоять всё время, пока рассказ идёт. Раньше на его месте была подсказка про
   * тап, которая учила жесту и уходила через два такта; в композиции-афише это
   * больше не подсказка, а сама кнопка «дальше», и уйти она имеет право ровно
   * один раз — когда сцена договорила и её место занимает главное действие.
   *
   * Проверяется поведение, а не число тактов: сколько именно их в сцене, решает
   * сценарий, и менять его можно свободно.
   */
  it('живёт весь рассказ и уступает место главному действию', async () => {
    render(<App />);
    await enterScene();
    expect(await screen.findByRole('button', { name: sceneUi.tapHint })).toBeTruthy();

    // Три такта — заведомо меньше, чем длится сцена, и заведомо больше, чем
    // держалась прежняя подсказка.
    for (let i = 0; i < 3; i += 1) await nextBeat();
    expect(preframeBeats.length).toBeGreaterThan(3);
    expect(screen.getByRole('button', { name: sceneUi.tapHint })).toBeTruthy();
    expect(screen.queryByRole('button', { name: preframe.cta })).toBeNull();

    // А договорив, сцена меняет продолжение на выход из неё. Ждём ухода, а не
    // проверяем мгновенно: пузырь исчезает с анимацией и ещё живёт в разметке.
    await skipScene();
    expect(await screen.findByRole('button', { name: preframe.cta })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: sceneUi.tapHint })).toBeNull(),
    );
  });
});

describe('вход в город', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  /**
   * РАССКАЗ НАЧИНАЕТСЯ НАЖАТИЕМ, НО ОТДЕЛЬНОГО ЭКРАНА ВХОДА НЕТ.
   *
   * Это прямая просьба заказчика: человек нажимает воспроизведение, и в этот
   * момент оживает сам город, — а не «сначала чат, потом сцена». Поэтому первый
   * кадр это уже афиша с первой репликой, и проверять здесь нужно ровно две
   * вещи: без нажатия рассказ НЕ ИДЁТ, после нажатия идёт.
   */
  it('до нажатия рассказ стоит, после — идёт', async () => {
    render(<App />);

    // Афиша на месте: первая реплика видна с самого начала.
    expect(screen.getByText(preframeBeats[0].say[0])).toBeTruthy();

    // Но дальше первого такта сцена не ушла: ни следующей реплики, ни
    // продолжения, ни «пропустить».
    expect(screen.queryByText(preframeBeats[1].say[0])).toBeNull();
    expect(screen.queryByRole('button', { name: sceneUi.tapHint })).toBeNull();
    expect(screen.queryByRole('button', { name: sceneUi.skip })).toBeNull();

    /**
     * Претензий клиента на первом кадре тоже нет. Они звучат ВНУТРИ записи и
     * показываются в тот момент, когда автор их произносит; выложенные ещё и на
     * вход, они превращали бы его в пересказ того, что человек через минуту
     * услышит.
     */
    for (const claim of preframe.claims) {
      expect(screen.queryByText(claim)).toBeNull();
    }

    await enterScene();

    expect(await screen.findByRole('button', { name: sceneUi.tapHint })).toBeTruthy();
    expect(await screen.findByRole('button', { name: sceneUi.skip })).toBeTruthy();
  });

  /**
   * У ВХОДА ДВЕ ДВЕРИ, И ОБЕ ВЕДУТ В ОДНО. Заказчик описал жест буквально: «он
   * нажимает Play, и в этот момент сам город начинает оживать». Значит кнопка
   * воспроизведения на карточке обязана запускать рассказ так же, как главное
   * действие внизу, — иначе самый очевидный жест первого кадра не делает ничего.
   */
  it('кнопка воспроизведения запускает рассказ так же, как главное действие', async () => {
    render(<App />);
    await press(playerUi.play);
    expect(await screen.findByRole('button', { name: sceneUi.tapHint })).toBeTruthy();
  });

  /**
   * ОТКАЗ ЗВУКА НЕ ИМЕЕТ ПРАВА ВЕШАТЬ РАССКАЗ.
   *
   * С 13.08.2026 сцену ведёт голос: индекс такта считается от позиции в записи.
   * Значит любой отказ — не доехал файл, не поддержан кодек, вкладка не дала
   * звук — означал бы город, замерший на первом кадре навсегда. В тестовой среде
   * звука нет вовсе, и это ровно тот случай: рассказ обязан идти дальше.
   *
   * Проверяется поведение, а не внутренний флаг: после нажатия человек может
   * пройти сцену и уйти на следующий шаг.
   */
  it('идёт дальше, даже когда звука нет', async () => {
    render(<App />);
    await press(playerUi.play);

    await skipScene();
    await press(preframe.cta);
    expect(useFunnel.getState().step).toBe('conversion');
  });

});

describe('композиция сцены', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  /**
   * ПЕРВАЯ СТРОКА ТАКТА — ЗАГОЛОВОК, ОСТАЛЬНЫЕ — ПОДСТРОЧНИК.
   *
   * На афише глаз ловит крупное первым, и первой строкой автор всегда
   * произносит саму мысль. Разделения на два поля в такте нет — сценарий
   * правится как речь, — поэтому роль строки решает разметка, и потерять это
   * решение можно молча: текст останется на экране, просто перестанет быть
   * заголовком.
   */
  it('первая строка такта — заголовок, остальные — подстрочник', async () => {
    render(<App />);
    const [title, sub] = preframeBeats[0].say;
    expect(sub).toBeTruthy();

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(sub).tagName).toBe('P');
  });

  /**
   * ЛОГА БОЛЬШЕ НЕТ: НА ЭКРАНЕ ТОЛЬКО ТЕКУЩАЯ РЕПЛИКА.
   *
   * Прежде сказанное копилось, потому что перемотки у сцены не было и упущенную
   * фразу нельзя было вернуть никак. Теперь возврат живёт на дорожке плеера, а
   * афиша показывает одну мысль за раз. Вернувшийся лог — это не украшение, а
   * другая композиция: текст полез бы вверх на автора и на витрину такта.
   */
  it('прошлая реплика уходит с экрана, а не копится', async () => {
    render(<App />);
    await enterScene();

    const [older, newer] = preframeBeats;
    expect(screen.getByText(older.say[0])).toBeTruthy();

    await nextBeat();

    expect(await screen.findByText(newer.say[0])).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(older.say[0])).toBeNull());
  });
});

describe('сброс прохода', () => {
  beforeEach(() => {
    cleanup();
    useFunnel.setState(useFunnel.getInitialState(), true);
    window.localStorage.clear();
  });

  it('возвращает в начало и стирает собранное', () => {
    useFunnel.setState({
      step: 'bundle',
      artifacts: ['audience', 'offer', 'landing'],
      passed: true,
      proofOpened: true,
    });

    useFunnel.getState().reset();

    const s = useFunnel.getState();
    expect(s.step).toBe(STEPS[0]);
    expect(s.artifacts).toEqual([]);
    expect(s.passed).toBe(false);
    expect(s.proofOpened).toBe(false);
  });

  /**
   * ГЛАВНОЕ ЗДЕСЬ, И ЭТО БЫЛА НАСТОЯЩАЯ ДЫРА.
   *
   * Сброс возвращает шаг в начало. Но если человек УЖЕ на первом шаге, значение
   * шага не меняется — React не видит причины перемонтировать экран, и сцена
   * остаётся досмотренной: такты проиграны, главное действие на месте. Кнопка
   * «начать сначала» при этом выглядит нажатой и не работающей.
   *
   * Проверяем не внутренности, а то, что видит человек: после сброса рассказ
   * снова ждёт согласия слушать, а главного действия, появляющегося в конце
   * сцены, на экране нет.
   */
  it('перезапускает сцену, даже когда шаг не изменился', async () => {
    render(<App />);
    await enterScene();
    await skipScene();

    // Сцена договорила: действие есть, продолжение ушло. Ждём его ухода, а не
    // проверяем мгновенно: пузырь исчезает с анимацией и ещё живёт в разметке,
    // пока та идёт.
    await screen.findByRole('button', { name: preframe.cta });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: sceneUi.tapHint })).toBeNull(),
    );

    await act(async () => {
      useFunnel.getState().reset();
    });

    expect(useFunnel.getState().step).toBe(STEPS[0]);
    // Сброс возвращает и к нажатию на воспроизведение: воронка начинается
    // заново целиком, а не с середины досмотренной сцены.
    await enterScene();
    expect(await screen.findByRole('button', { name: sceneUi.tapHint })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: preframe.cta })).toBeNull(),
    );
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
