import { questionKey, type Question } from './questions';

export function localizeSessionQuestions(saved: Question[], localized: Question[]) {
  const byKey = new Map(localized.map((item) => [questionKey(item), item]));
  return saved.map((question) => {
    const translated = byKey.get(questionKey(question));
    if (!translated) throw new Error('invalidQuestionData');
    const choices = question.choices
      .map(({ id }) => translated.choices.find((choice) => choice.id === id))
      .filter((choice): choice is Question['choices'][number] => choice !== undefined);
    if (choices.length !== translated.choices.length) throw new Error('invalidQuestionData');
    return { ...translated, choices };
  });
}
