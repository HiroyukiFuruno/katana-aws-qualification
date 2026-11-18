export type Question = {
  id: string;
  revision: number;
  category: string;
  version: string;
  title: string;
  prompt: string;
  choices: { id: string; text: string; explanation: string }[];
  correct: string[];
  source: { url: string; label: string };
  learning?: {
    reason: string;
    concept: string;
    check: { prompt: string; answer: string };
  };
};

export const questionKey = (question: Pick<Question, 'id' | 'revision'>) =>
  JSON.stringify([question.id, question.revision]);

export async function loadQuestions(filename: string): Promise<Question[]> {
  const response = await fetch('./' + filename, { cache: 'no-cache' });
  if (!response.ok) throw new Error('問題データを取得できませんでした。');
  const questions: Question[] = await response.json();
  const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  if (!Array.isArray(questions) || !questions.length) throw new Error('問題データが空です。');
  const ids = new Set<string>();
  for (const question of questions) {
    if (!question || !text(question.id) || ids.has(question.id) ||
        !Number.isSafeInteger(question.revision) || question.revision < 1 ||
        ![question.category, question.version, question.title, question.prompt, question.source?.label].every(text) ||
        !text(question.source?.url) || !question.source.url.startsWith('https://') ||
        (question.learning !== undefined && ![
          question.learning?.reason, question.learning?.concept,
          question.learning?.check?.prompt, question.learning?.check?.answer,
        ].every(text)) ||
        !Array.isArray(question.choices) || question.choices.length < 2 ||
        !question.choices.every(choice => choice && [choice.id, choice.text, choice.explanation].every(text)) ||
        new Set(question.choices.map(choice => choice.id)).size !== question.choices.length ||
        !Array.isArray(question.correct) || !question.correct.length ||
        new Set(question.correct).size !== question.correct.length ||
        !question.correct.every(id => question.choices.some(choice => choice.id === id))) {
      throw new Error('問題データの形式を確認してください。');
    }
    ids.add(question.id);
  }
  return questions;
}
