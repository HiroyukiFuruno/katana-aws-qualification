import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import { questionTranslationSource } from '../src/questionTranslationSource';
import { validateTranslation } from './content-translation-validation';
import { assertPositionIndependentQuestion } from './question-position-validation';

export { questionTranslationSource };

export function naturalQuestionHash(question: Question, sourceLocale = 'ja') {
  return createHash('sha256')
    .update(
      (sourceLocale === 'ja' ? '' : `${sourceLocale}\n`) +
        JSON.stringify(questionTranslationSource(question)),
    )
    .digest('hex');
}

export function mergeNaturalQuestion(
  source: Question,
  translation: Record<string, unknown>,
  locale: Locale,
): Question {
  assert.equal(translation.id, source.id, 'Natural translation changed question ID');
  const { learning, prompts, references, ...fields } = translation;
  const result = { ...source, ...fields } as Question;
  if (source.learning) {
    assert(learning && typeof learning === 'object', 'Missing learning notes');
    const notes = learning as Record<string, unknown>;
    assert(
      typeof notes.reason === 'string' && typeof notes.concept === 'string',
      'Invalid learning text',
    );
    result.learning = { reason: notes.reason, concept: notes.concept };
    if (source.learning.check) {
      assert(notes.check && typeof notes.check === 'object', 'Missing knowledge check');
      result.learning.check = notes.check as { prompt: string; answer: string };
    } else assert.equal(notes.check, null, 'Invented knowledge check');
  } else assert.equal(learning, null, 'Invented learning notes');
  if (source.format === 'matching') {
    assert(Array.isArray(prompts), 'Missing matching prompts');
    (result as Question & { prompts: unknown }).prompts = prompts;
  } else assert.equal(prompts, null, 'Invented matching prompts');
  if (source.references) {
    assert(Array.isArray(references), 'Missing reference labels');
    result.references = references;
  } else
    assert(
      references === undefined ||
        references === null ||
        (Array.isArray(references) && references.length === 0),
      'Invented references',
    );
  const expected = questionTranslationSource(source);
  validateTranslation(expected, result, locale, `${source.id}/${locale}`);
  assertPositionIndependentQuestion(result, `${source.id}/${locale}`);
  return result;
}
