import { useId } from 'react';
import { usePreferences } from './preferences';
import { QuestionSources } from './QuestionSources';
import type { Question } from './questions';
import { choiceLabel } from './choiceLabels';

export function LearningNotes({ question, selected }: { question: Question; selected: string[] }) {
  const { locale, t } = usePreferences();
  const heading = useId();
  const notes = question.learning;
  const selectedWrong = question.choices.filter(
    (choice) => selected.includes(choice.id) && !question.correct.includes(choice.id),
  );
  const missed = question.choices.filter(
    (choice) => !selected.includes(choice.id) && question.correct.includes(choice.id),
  );
  const feedback = [
    ...selectedWrong.map((choice) => ({ choice, label: t('pickedWrong') })),
    ...missed.map((choice) => ({
      choice,
      label: selected.length ? t('missedCorrect') : t('unansweredCorrect'),
    })),
  ];
  if (!notes) {
    return <QuestionSources question={question} />;
  }

  return (
    <section className="learning-notes" aria-labelledby={heading}>
      <h3 id={heading}>{t('answerReview')}</h3>
      {!question.format && feedback.length > 0 && (
        <div className="answer-feedback">
          <h4>{t('answerTakeaway')}</h4>
          <ul>
            {feedback.map(({ choice, label }) => (
              <li key={choice.id}>
                <strong>
                  {label} {choiceLabel(question.choices, choice.id)} ·{' '}
                  <span lang={question.locale ?? locale}>{choice.text}</span>
                </strong>
                <p lang={question.locale ?? locale}>{choice.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl>
        <dt>{t('reason')}</dt>
        <dd lang={question.locale ?? locale}>{notes.reason}</dd>
        <dt>{t('concept')}</dt>
        <dd lang={question.locale ?? locale}>{notes.concept}</dd>
      </dl>
      {notes.check && (
        <details>
          <summary>{t('knowledgeCheck')}</summary>
          <p lang={question.locale ?? locale}>{notes.check.prompt}</p>
          <details className="learning-answer">
            <summary>{t('reasoning')}</summary>
            <p lang={question.locale ?? locale}>{notes.check.answer}</p>
          </details>
        </details>
      )}
      <QuestionSources question={question} />
    </section>
  );
}
