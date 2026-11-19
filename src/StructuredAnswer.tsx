import { usePreferences } from './preferences';
import type { StructuredQuestion } from './questions';

export function StructuredAnswerFields({
  question,
  selected,
  onChange,
}: {
  question: StructuredQuestion;
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const { t } = usePreferences();
  const slots =
    question.format === 'matching'
      ? question.prompts
      : question.correct.map((_, index) => ({
          id: String(index + 1),
          text: t('answerStep', { number: index + 1 }),
        }));
  return (
    <div className="structured-answer-fields">
      {slots.map((slot, index) => (
        <label key={slot.id} className="structured-answer-field">
          <span lang={question.format === 'matching' ? 'ja' : undefined}>{slot.text}</span>
          <select
            value={selected[index] ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              const next = slots.map((_, position) =>
                position === index ? id : (selected[position] ?? ''),
              );
              onChange(next.some(Boolean) ? next : []);
            }}
          >
            <option value="">{t('none')}</option>
            {question.choices.map((choice) => (
              <option
                key={choice.id}
                value={choice.id}
                lang="ja"
                disabled={selected.some((id, position) => id === choice.id && position !== index)}
              >
                {choice.id} · {choice.text}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function StructuredAnswerReview({
  question,
  selected,
}: {
  question: StructuredQuestion;
  selected: string[];
}) {
  const { t } = usePreferences();
  const choices = new Map(question.choices.map((choice) => [choice.id, choice]));
  const distractors = question.choices.filter((choice) => !question.correct.includes(choice.id));
  return (
    <>
      <ol className="structured-answer-review">
        {question.correct.map((id, index) => {
          const actual = choices.get(selected[index]);
          const expected = choices.get(id);
          const slot = question.prompts?.[index];
          return (
            <li key={slot?.id ?? id} className={actual?.id === id ? 'right' : 'wrong'}>
              <strong lang={slot ? 'ja' : undefined}>
                {slot?.text ?? t('answerStep', { number: index + 1 })}
              </strong>
              <dl>
                <div>
                  <dt>{t('selected')}</dt>
                  <dd lang={actual ? 'ja' : undefined}>{actual?.text ?? t('none')}</dd>
                </div>
                <div>
                  <dt>{t('correct')}</dt>
                  <dd lang="ja">{expected?.text}</dd>
                </div>
              </dl>
              <p className="explanation" lang="ja">
                {expected?.explanation}
              </p>
            </li>
          );
        })}
      </ol>
      {distractors.length > 0 && (
        <details>
          <summary>{t('optionExplanations')}</summary>
          <ul lang="ja">
            {distractors.map((choice) => (
              <li key={choice.id}>
                <strong>
                  {choice.id} · {choice.text}
                </strong>
                <p>{choice.explanation}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
