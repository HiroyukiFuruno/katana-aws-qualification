import { expect, test } from 'bun:test';
import { formatQuantityMessage } from '../src/locales/quantity';
import { messages } from '../src/messages';

function format(
  locale: keyof typeof messages,
  key: 'score' | 'choose' | 'selectedCount' | 'glossaryCount' | 'lessonFinalRules',
  values: Record<string, number>,
) {
  return formatQuantityMessage(locale, key, messages[locale][key], values).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(values[name]),
  );
}

test('scoreとchooseはcorrect/countを単独operandとして選ぶ', () => {
  const score = {
    en: ['1 of 2 correct', '0 of 2 correct', '2 of 2 correct'],
    pt: ['1 de 2 correta', '0 de 2 corretas', '2 de 2 corretas'],
    fr: ['1 bonne réponse sur 2', '0 bonnes réponses sur 2', '2 bonnes réponses sur 2'],
    de: ['1 von 2 richtig', '0 von 2 richtig', '2 von 2 richtig'],
    es: ['1 de 2 correcta', '0 de 2 correctas', '2 de 2 correctas'],
    it: ['1 risposta corretta su 2', '0 risposte corrette su 2', '2 risposte corrette su 2'],
  } as const;
  const choose = {
    en: ['Select 1', 'Select 2'],
    pt: ['Selecione 1', 'Selecione 2'],
    fr: ['Sélectionnez 1 option', 'Sélectionnez 2 options'],
    de: ['1 auswählen', '2 auswählen'],
    es: ['Selecciona 1', 'Selecciona 2'],
    it: ['Scegli 1', 'Seleziona 2'],
  } as const;
  for (const locale of Object.keys(score) as (keyof typeof score)[]) {
    expect(format(locale, 'score', { correct: 1, total: 2 })).toBe(score[locale][0]);
    expect(format(locale, 'score', { correct: 0, total: 2 })).toBe(score[locale][1]);
    expect(format(locale, 'score', { correct: 2, total: 2 })).toBe(score[locale][2]);
    expect(format(locale, 'choose', { count: 1 })).toBe(choose[locale][0]);
    expect(format(locale, 'choose', { count: 2 })).toBe(choose[locale][1]);
  }
});

test('selected、glossary、final ruleは全EU localeで指定operandを独立して選ぶ', () => {
  const finalTerms = {
    en: [
      ['1 question', '2 questions'],
      ['1 correct answer', '2 correct answers'],
    ],
    pt: [
      ['1 pergunta', '2 perguntas'],
      ['pelo menos 1', 'pelo menos 2'],
    ],
    fr: [
      ['1 question', '2 questions'],
      ['1 bonne réponse', '2 bonnes réponses'],
    ],
    de: [
      ['1 Frage', '2 Fragen'],
      ['1 richtige Antwort', '2 richtige Antworten'],
    ],
    es: [
      ['1 pregunta', '2 preguntas'],
      ['1 respuesta correcta', '2 respuestas correctas'],
    ],
    it: [
      ['1 domanda', '2 domande'],
      ['1 risposta corretta', '2 risposte corrette'],
    ],
  } as const;
  for (const [locale, [totals, corrects]] of Object.entries(finalTerms) as [
    keyof typeof finalTerms,
    readonly [readonly string[], readonly string[]],
  ][])
    for (const [correct, total] of [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ] as const) {
      const rendered = format(locale, 'lessonFinalRules', { correct, total });
      expect(rendered).toContain(totals[total - 1]);
      expect(rendered).toContain(corrects[correct - 1]);
    }
  const operands = {
    en: [
      ['1 / 2 selected', '2 / 2 selected'],
      ['1 / 1 term', '1 / 2 terms'],
    ],
    pt: [
      ['1 / 2 selecionada', '2 / 2 selecionadas'],
      ['1 / 1 termo', '1 / 2 termos'],
    ],
    fr: [
      ['1 / 2 sélectionnée', '2 / 2 sélectionnées'],
      ['1 / 1 terme', '1 / 2 termes'],
    ],
    de: [
      ['1 / 2 ausgewählt', '2 / 2 ausgewählt'],
      ['1 / 1 Begriff', '1 / 2 Begriffe'],
    ],
    es: [
      ['1 / 2 seleccionada', '2 / 2 seleccionadas'],
      ['1 / 1 término', '1 / 2 términos'],
    ],
    it: [
      ['1 / 2 selezionata', '2 / 2 selezionate'],
      ['1 / 1 termine', '1 / 2 termini'],
    ],
  } as const;
  for (const [locale, [selected, glossary]] of Object.entries(operands) as [
    keyof typeof operands,
    readonly [readonly string[], readonly string[]],
  ][]) {
    expect(format(locale, 'selectedCount', { selected: 1, count: 2 })).toBe(selected[0]);
    expect(format(locale, 'selectedCount', { selected: 2, count: 2 })).toBe(selected[1]);
    expect(format(locale, 'glossaryCount', { count: 1, total: 1 })).toBe(glossary[0]);
    expect(format(locale, 'glossaryCount', { count: 1, total: 2 })).toBe(glossary[1]);
  }
});
