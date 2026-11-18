import { usePreferences } from './preferences';
import { useId } from 'react';
import type { Question } from './questions';

export function LearningNotes({ question, selected }: { question: Question; selected: string[] }) {
  const { t } = usePreferences();
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
    return (
      <a href={question.source.url} target="_blank" rel="noreferrer">
        {question.source.label} ↗
      </a>
    );
  }

  return (
    <section className="learning-notes" aria-labelledby={heading}>
      <h3 id={heading}>{t('answerReview')}</h3>
      {feedback.length > 0 && (
        <div className="answer-feedback">
          <h4>{t('answerTakeaway')}</h4>
          <ul>
            {feedback.map(({ choice, label }) => (
              <li key={choice.id}>
                <strong>
                  {label} {choice.id} · {choice.text}
                </strong>
                <p>{choice.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl>
        <dt>{t('reason')}</dt>
        <dd lang="ja">{notes.reason}</dd>
        <dt>{t('concept')}</dt>
        <dd lang="ja">{notes.concept}</dd>
      </dl>
      {notes.check && (
        <details>
          <summary>{t('knowledgeCheck')}</summary>
          <p>{notes.check.prompt}</p>
          <details className="learning-answer">
            <summary>{t('reasoning')}</summary>
            <p>{notes.check.answer}</p>
          </details>
        </details>
      )}
      <a href={question.source.url} target="_blank" rel="noreferrer">
        {question.source.label} ↗
      </a>
    </section>
  );
}
