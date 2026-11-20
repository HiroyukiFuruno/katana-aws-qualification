import type { Locale } from './locales.ts';
import { examDomainOf, parseQuestions, type Question } from './questions.ts';

type TranslatedChoice = Pick<Question['choices'][number], 'text' | 'explanation'>;
type QuestionTranslation = Pick<Question, 'title' | 'prompt' | 'learning'> & {
  choices: Record<string, TranslatedChoice>;
};

type BankTranslation = {
  categories: Record<string, string>;
  sourceLabels: Record<string, string>;
  questions: Record<string, QuestionTranslation>;
};

const invalid = () => new Error('invalidQuestionData');
export const translationKey = ({ id, revision }: Question) => `${id}@${revision}`;

export function questionTranslationPath(directory: string | undefined, locale: Locale) {
  return directory && locale !== 'ja' ? `${directory}/${locale}.json` : undefined;
}

export async function fetchQuestionTranslation(path: string): Promise<unknown> {
  const response = await fetch(`/${path}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('loadQuestionError');
  return response.json();
}

export function applyQuestionTranslation(bank: Question[], locale: Locale, value: unknown): Question[] {
  const translation = value as BankTranslation;
  if (!translation?.questions || !translation.categories || !translation.sourceLabels) throw invalid();
  return parseQuestions(
    bank.map((question) => {
      const text = translation.questions[translationKey(question)];
      if (!text?.choices || Boolean(text.learning) !== Boolean(question.learning)) throw invalid();
      if (Object.keys(text.choices).length !== question.choices.length) throw invalid();
      if (Boolean(text.learning?.check) !== Boolean(question.learning?.check)) throw invalid();
      const choices = question.choices.map((choice) => {
        const translated = text.choices[choice.id];
        if (!translated) throw invalid();
        return { id: choice.id, text: translated.text, explanation: translated.explanation };
      });
      return {
        ...question,
        locale,
        title: text.title,
        prompt: text.prompt,
        examDomain: examDomainOf(question),
        category: translation.categories[question.category],
        source: {
          ...question.source,
          label: translation.sourceLabels[question.source.label],
        },
        references: question.references?.map((source) => ({
          ...source,
          label: translation.sourceLabels[source.label],
        })),
        choices,
        learning: text.learning,
      };
    }),
  );
}
