import { answerLabels, choiceLabel } from './choiceLabels';
import { normalizeChoiceOrder } from './choiceOrder';
import type { Attempt } from './history';
import { LearningNotes } from './LearningNotes';
import { usePreferences } from './preferences';
import { QuestionClarifications } from './QuestionClarifications';
import { isAnswerComplete, type Question } from './questions';
import { StructuredAnswerReview } from './StructuredAnswer';

export function ExamSolution({
  attempt,
  item,
  index,
  choiceOrder,
}: {
  attempt: Attempt;
  item: Question | undefined;
  index: number;
  choiceOrder: string[] | undefined;
}) {
  const { t } = usePreferences();
  const answered = item
    ? isAnswerComplete(item, attempt.selected)
    : attempt.selected.filter(Boolean).length === attempt.correct.length;
  const choices = item
    ? normalizeChoiceOrder(choiceOrder, item.choices).flatMap((id) => {
        const choice = item.choices.find((candidate) => candidate.id === id);
        return choice ? [choice] : [];
      })
    : [];
  return (
    <details>
      <summary>
        {t('questionNumber', { number: index + 1 })} ·{' '}
        {attempt.isCorrect ? t('correct') : answered ? t('incorrect') : t('unanswered')} ·{' '}
        <span lang={item?.locale}>{item?.title ?? attempt.questionId}</span>
      </summary>
      <p lang={item?.locale}>{item?.prompt}</p>
      {item && <QuestionClarifications question={item} />}
      {item?.format ? (
        <StructuredAnswerReview question={item} selected={attempt.selected} />
      ) : (
        <p>
          {t('selected')} {answerLabels(choices, attempt.selected) || t('none')} ／ {t('correct')}{' '}
          {answerLabels(choices, attempt.correct)}
        </p>
      )}
      {item && <LearningNotes question={{ ...item, choices }} selected={attempt.selected} />}
      {item && !item.format && (
        <ul>
          {choices.map((choice) => (
            <li key={choice.id}>
              <strong>
                {choiceLabel(choices, choice.id)}{' '}
                {attempt.correct.includes(choice.id) ? t('correct') : t('incorrect')} ·{' '}
                <span lang={item.locale}>{choice.text}</span>
              </strong>
              <br />
              <span lang={item.locale}>{choice.explanation}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
