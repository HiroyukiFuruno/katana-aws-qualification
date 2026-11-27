import { useState } from 'react';
import { usePreferences } from '../preferences';
import { isAnswerComplete, isCorrectAnswer } from '../questions';
import { shuffle } from '../randomization';
import type { StudyCheckpoint } from './types';

export function StudyCheckpointForm({ question }: { question: StudyCheckpoint }) {
  const { t } = usePreferences();
  const [choices] = useState(() => shuffle(question.choices));
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const single = question.correct.length === 1;
  const complete = isAnswerComplete(question, selected);
  const correct = submitted && isCorrectAnswer(question, selected);
  function choose(id: string) {
    setSelected((current) => {
      if (single) return [id];
      if (current.includes(id)) return current.filter((choice) => choice !== id);
      return [...current, id];
    });
  }
  return (
    <form
      className="card qualification-checkpoint"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete) setSubmitted(true);
      }}
    >
      <fieldset disabled={submitted}>
        <legend>{question.prompt}</legend>
        <p>{t('choose', { count: question.correct.length })}</p>
        {choices.map(({ id, text, explanation }) => {
          const checked = selected.includes(id);
          const answer = question.correct.includes(id);
          return (
            <div className="choice-wrap" key={id}>
              <label className={submitted && answer ? 'choice right' : 'choice'}>
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name={question.id}
                  value={id}
                  checked={checked}
                  onChange={() => choose(id)}
                />
                <span>{text}</span>
              </label>
              {submitted && <p>{explanation}</p>}
            </div>
          );
        })}
      </fieldset>
      {submitted ? (
        <p className={correct ? 'good-text' : 'bad-text'} role="status">
          {t(correct ? 'correct' : 'incorrect')}
        </p>
      ) : (
        <button type="submit" className="primary" disabled={!complete}>
          {t('lessonCheckpointSubmit')}
        </button>
      )}
    </form>
  );
}
