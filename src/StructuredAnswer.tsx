import { usePreferences } from './preferences';
import type { StructuredQuestion } from './questions';
import { choiceLabel } from './choiceLabels';

export function StructuredAnswerFields({
  question,
  selected,
  choiceOrder,
  onChange,
}: {
  question: StructuredQuestion;
  selected: string[];
  choiceOrder?: string[];
  onChange: (selected: string[]) => void;
}) {
  const { locale, t } = usePreferences();
  const slots =
    question.format === 'matching'
      ? question.prompts
      : question.correct.map((_, index) => ({
          id: String(index + 1),
          text: t('answerStep', { number: index + 1 }),
        }));
  const choices =
    choiceOrder
      ?.map((id) => question.choices.find((choice) => choice.id === id))
      .filter((choice): choice is StructuredQuestion['choices'][number] => choice !== undefined) ??
    question.choices;
  return (
    <div className="structured-answer-fields">
      {slots.map((slot, index) => (
        <label key={slot.id} className="structured-answer-field">
          <span lang={question.format === 'matching' ? (question.locale ?? locale) : undefined}>
            {slot.text}
          </span>
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
            {choices.map((choice) => (
              <option
                key={choice.id}
                value={choice.id}
                lang={question.locale ?? locale}
                disabled={selected.some((id, position) => id === choice.id && position !== index)}
              >
                {choiceLabel(choices, choice.id)} · {choice.text}
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
  const { locale, t } = usePreferences();
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
              <strong lang={slot ? (question.locale ?? locale) : undefined}>
                {slot?.text ?? t('answerStep', { number: index + 1 })}
              </strong>
              <dl>
                <div>
                  <dt>{t('selected')}</dt>
                  <dd lang={actual ? (question.locale ?? locale) : undefined}>
                    {actual?.text ?? t('none')}
                  </dd>
                </div>
                <div>
                  <dt>{t('correct')}</dt>
                  <dd lang={question.locale ?? locale}>{expected?.text}</dd>
                </div>
              </dl>
              <p className="explanation" lang={question.locale ?? locale}>
                {expected?.explanation}
              </p>
            </li>
          );
        })}
      </ol>
      {distractors.length > 0 && (
        <details>
          <summary>{t('optionExplanations')}</summary>
          <ul lang={question.locale ?? locale}>
            {distractors.map((choice) => (
              <li key={choice.id}>
                <strong>
                  {choiceLabel(question.choices, choice.id)} · {choice.text}
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
