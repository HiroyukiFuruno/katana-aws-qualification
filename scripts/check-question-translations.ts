import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { locales } from '../src/locales.ts';
import { examDomainOf, type Question, questionGroupKey, questionKey } from '../src/questions.ts';
import {
  applyQuestionTranslation,
  questionTranslationPath,
  translationKey,
} from '../src/questionTranslations.ts';

export async function checkQuestionTranslations(directory: string, banks: Question[][]) {
  const source = banks.flat();
  const keys = [...new Set(source.map(translationKey))].sort();
  for (const locale of locales) {
    const path = questionTranslationPath(directory, locale);
    if (!path) continue;
    const content = JSON.parse(await readFile(`public/${path}`, 'utf8'));
    assert.deepEqual(Object.keys(content.questions).sort(), keys, path);
    banks.forEach((bank) => {
      const localized = applyQuestionTranslation(bank, locale, content);
      localized.forEach((item, index) => {
        const base = bank[index];
        const context = `${path}: ${item.id}`;
        assert.equal(item.locale, locale, context);
        assert.equal(questionKey(item), questionKey(base), context);
        assert.equal(questionGroupKey(item), questionGroupKey(base), context);
        assert.equal(examDomainOf(item), examDomainOf(base), context);
        assert.deepEqual(item.correct, base.correct, context);
        assert.deepEqual(
          item.choices.map(({ id }) => id),
          base.choices.map(({ id }) => id),
          context,
        );
        assert.equal(item.source.url, base.source.url, context);
        assert.notEqual(item.prompt, base.prompt, context);
        assert.notEqual(item.title, base.title, context);
        for (const [index, choice] of item.choices.entries()) {
          assert.notEqual(choice.text, base.choices[index].text, context);
          assert.notEqual(choice.explanation, base.choices[index].explanation, context);
        }
        assert.notEqual(item.learning?.reason, base.learning?.reason, context);
        assert.notEqual(item.learning?.concept, base.learning?.concept, context);
      });
    });
  }
  console.log(
    `Validated ${locales.length - 1} translations of ${keys.length} questions in ${directory}`,
  );
}
