import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('Italian model retraining does not become professional reskilling', () => {
  const source =
    '社内文書が頻繁に更新される。最新の文書断片を参照した回答を生成し、モデルの再訓練を避けるには？';
  expect(() =>
    validateTranslation(
      source,
      'I documenti interni vengono aggiornati frequentemente. Come generare risposte che facciano riferimento agli ultimi frammenti di documenti ed evitare di riqualificare il modello?',
      'it',
      'assessment.i1.prompt',
    ),
  ).toThrow('Italian model retraining terminology');
  expect(() =>
    validateTranslation(
      source,
      'I documenti interni vengono aggiornati spesso. Come generare risposte basate sui frammenti più recenti dei documenti senza riaddestrare il modello?',
      'it',
      'assessment.i1.prompt',
    ),
  ).not.toThrow();
});

test('Italian professional reskilling remains valid in workforce content', () => {
  expect(() =>
    validateTranslation(
      '従業員のスキル転換に向けて再訓練を行う。',
      'Riqualificare il personale per sviluppare nuove competenze.',
      'it',
      'workforce',
    ),
  ).not.toThrow();
});
