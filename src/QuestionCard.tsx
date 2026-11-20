import { useEffect, useRef, useState } from 'react';
import type { Attempt } from './history';
import { LearningNotes } from './LearningNotes';
import { usePreferences } from './preferences';
import { isAnswerComplete, type Question } from './questions';
import { StructuredAnswerFields, StructuredAnswerReview } from './StructuredAnswer';

type Props = {
  question: Question;
  onAnswer: (selected: string[], elapsed: number) => Promise<Attempt>;
  onNext: () => void;
  last: boolean;
};
export function QuestionCard({ question, onAnswer, onNext, last }: Props) {
  const { t } = usePreferences();
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Attempt>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const resultSummary = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState(false);
  const [started] = useState(() => performance.now());
  const count = question.correct.length;
  const lang = question.locale ?? 'ja';
  const complete = isAnswerComplete(question, selected);
  useEffect(() => {
    if (result) resultSummary.current?.focus();
  }, [result]);
  async function submit() {
    if (pending.current || result || !complete) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      setResult(await onAnswer(selected, Math.round(performance.now() - started)));
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="card" aria-labelledby="question-title">
      <div className="question-meta">
        <span lang={lang}>{question.category}</span>
        <span>
          {question.format === 'ordering'
            ? t('orderSteps')
            : question.format === 'matching'
              ? t('matchPairs')
              : t('choose', { count })}
        </span>
      </div>
      <h2 id="question-title" lang={result ? lang : undefined}>
        {result ? question.title : t('question')}
      </h2>
      <p className="prompt" lang={lang}>
        {question.prompt}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {result && (
          <p
            ref={resultSummary}
            tabIndex={-1}
            role="status"
            className={result.isCorrect ? 'good-text' : 'bad-text'}
          >
            <strong>
              {result.isCorrect ? t('correct') : t('incorrect')}
              {!question.format && ` · ${t('correct')} ${result.correct.join('・')}`}
            </strong>
          </p>
        )}
        {result && <LearningNotes question={question} selected={result.selected} />}
        {question.format ? (
          result ? (
            <StructuredAnswerReview question={question} selected={result.selected} />
          ) : (
            <fieldset disabled={busy}>
              <legend className="sr-only">{t('choices')}</legend>
              <StructuredAnswerFields question={question} selected={selected} onChange={setSelected} />
            </fieldset>
          )
        ) : (
          <fieldset disabled={busy || !!result}>
            <legend className={result ? 'choice-legend' : 'sr-only'}>
              {result ? t('optionExplanations') : t('choices')}
            </legend>
            {question.choices.map((choice) => {
              const checked = selected.includes(choice.id);
              const correct = result?.correct.includes(choice.id);
              return (
                <div key={choice.id} className="choice-wrap">
                  <label
                    className={`choice ${result ? (correct ? 'right' : checked ? 'wrong' : '') : checked ? 'picked' : ''}`}
                  >
                    <input
                      type={count === 1 ? 'radio' : 'checkbox'}
                      name="answer"
                      checked={checked}
                      disabled={!result && count > 1 && !checked && selected.length === count}
                      onChange={() =>
                        setSelected(
                          count === 1
                            ? [choice.id]
                            : checked
                              ? selected.filter((id) => id !== choice.id)
                              : [...selected, choice.id],
                        )
                      }
                    />
                    <span className="letter">{choice.id}</span>
                    <span lang={lang}>{choice.text}</span>
                  </label>
                  {result && (
                    <p className="explanation">
                      <strong>{correct ? t('correct') : t('incorrect')}</strong>{' '}
                      <span lang={lang}>{choice.explanation}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </fieldset>
        )}
        {error && <p role="alert">{t('studySaveFailed')}</p>}
        {result ? (
          <div className="answer-footer">
            <button type="button" className="primary" onClick={onNext}>
              {last ? t('viewResults') : t('next')}
            </button>
          </div>
        ) : (
          <div className="answer-footer">
            <span>{t('selectedCount', { selected: selected.filter(Boolean).length, count })}</span>
            <button type="submit" className="primary" disabled={!complete || busy}>
              {t('grade')}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
