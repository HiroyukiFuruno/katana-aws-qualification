import keys from './question-clarifications.json';
import type { Message } from './messages';
import { usePreferences } from './preferences';
import { questionKey, type Question } from './questions';

export function QuestionClarifications({ question }: { question: Pick<Question, 'id' | 'revision'> }) {
  const { t } = usePreferences();
  const entries = keys as Record<string, Message[]>;
  return (entries[questionKey(question)] ?? []).map((key) => (
    <p className="question-clarification" key={key}>
      {t(key)}
    </p>
  ));
}
