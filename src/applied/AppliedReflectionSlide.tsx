import { useId, useState } from 'react';
import { inlineCaseText } from './AppliedSectionContent';
import type { appliedSlideCopy } from './slideContent';
import { appliedAnswerLimit } from './slideRecord';

export function AppliedReflectionSlide({
  scenario,
  explanation,
  reviewedAnswer,
  copy,
  onReview,
}: {
  scenario: string;
  explanation: string;
  reviewedAnswer?: string;
  copy: ReturnType<typeof appliedSlideCopy>;
  onReview: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const fieldId = useId();
  return (
    <div className="applied-reflection">
      <p>{inlineCaseText(scenario)}</p>
      {reviewedAnswer ? (
        <>
          <p className="applied-reflection-answer">{reviewedAnswer}</p>
          <div>
            <h2>{copy.explanation}</h2>
            <p>{inlineCaseText(explanation)}</p>
          </div>
          <p role="status">{copy.reviewed}</p>
        </>
      ) : (
        <form
          className="applied-reflection"
          onSubmit={(event) => {
            event.preventDefault();
            const value = answer.trim();
            if (value) onReview(value);
          }}
        >
          <label htmlFor={fieldId}>{copy.answer}</label>
          <textarea
            id={fieldId}
            maxLength={appliedAnswerLimit}
            onChange={(event) => setAnswer(event.currentTarget.value)}
            rows={4}
            value={answer}
          />
          <button className="primary" type="submit" disabled={!answer.trim()}>
            {copy.reveal}
          </button>
        </form>
      )}
    </div>
  );
}
