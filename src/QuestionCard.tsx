import { useEffect, useState, useRef } from 'react';
import { LearningNotes } from './LearningNotes';
import type { Question } from './questions';
import type { Attempt } from './history';

type Props = {
  question: Question;
  onAnswer: (selected: string[], elapsed: number) => Promise<Attempt>;
  onNext: () => void;
  last: boolean;
};

export function QuestionCard({ question, onAnswer, onNext, last }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Attempt>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const resultSummary = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState(false);
  const [started] = useState(() => performance.now());
  const count = question.correct.length;

  useEffect(() => {
    if (result) resultSummary.current?.focus();
  }, [result]);

  async function submit() {
    if (pending.current || result || selected.length !== count) return;
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

  return <section className="card" aria-labelledby="question-title">
    <div className="question-meta"><span>{question.category}</span><span>{count}つ選択</span></div>
    <h2 id="question-title">{result ? question.title : '設問'}</h2>
    <p className="prompt">{question.prompt}</p>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      {result && <p ref={resultSummary} tabIndex={-1} role="status" className={result.isCorrect ? 'good-text' : 'bad-text'}>
        <strong>{result.isCorrect ? '正解' : '不正解'} · 正解 {result.correct.join('・')}</strong>
      </p>}
      {result && <LearningNotes question={question} selected={result.selected} />}
      <fieldset disabled={busy || !!result}>
        <legend className={result ? 'choice-legend' : 'sr-only'}>{result ? '選択肢ごとの解説' : '回答選択肢'}</legend>
        {question.choices.map(choice => {
          const checked = selected.includes(choice.id);
          const correct = result?.correct.includes(choice.id);
          return <div key={choice.id} className="choice-wrap">
            <label className={`choice ${result ? (correct ? 'right' : checked ? 'wrong' : '') : checked ? 'picked' : ''}`}>
              <input type={count === 1 ? 'radio' : 'checkbox'} name="answer" checked={checked}
                disabled={!result && count > 1 && !checked && selected.length === count}
                onChange={() => setSelected(count === 1 ? [choice.id] :
                  checked ? selected.filter(id => id !== choice.id) : [...selected, choice.id])} />
              <span className="letter">{choice.id}</span><span>{choice.text}</span>
            </label>
            {result && <p className="explanation"><strong>{correct ? '正解' : '不正解'}</strong> {choice.explanation}</p>}
          </div>;
        })}
      </fieldset>
      {error && <p role="alert">学習履歴を保存できませんでした。保存領域の設定を確認してから再試行してください。</p>}
      {result ? <div className="answer-footer">
        <button type="button" className="primary" onClick={onNext}>{last ? '結果を見る' : '次の問題へ'}</button>
      </div> : <div className="answer-footer">
        <span>{selected.length} / {count} 選択済み</span>
        <button type="submit" className="primary" disabled={selected.length !== count || busy}>採点する</button>
      </div>}
    </form>
  </section>;
}
