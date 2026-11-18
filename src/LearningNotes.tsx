import { useId } from 'react';
import type { Question } from './questions';

export function LearningNotes({ question, selected }: { question: Question; selected: string[] }) {
  const heading = useId();
  const notes = question.learning;
  const selectedWrong = question.choices.filter(choice =>
    selected.includes(choice.id) && !question.correct.includes(choice.id));
  const missed = question.choices.filter(choice =>
    !selected.includes(choice.id) && question.correct.includes(choice.id));
  const feedback = [
    ...selectedWrong.map(choice => ({ choice, label: '選んだ誤答' })),
    ...missed.map(choice => ({ choice, label: selected.length ? '選べなかった正解' : '未回答の正解' })),
  ];
  if (!notes) {
    return <a href={question.source.url} target="_blank" rel="noreferrer">{question.source.label} ↗</a>;
  }

  return <section className="learning-notes" aria-labelledby={heading}>
    <h3 id={heading}>解答の振り返り</h3>
    {feedback.length > 0 && <div className="answer-feedback">
      <h4>今回の回答で押さえる点</h4>
      <ul>{feedback.map(({ choice, label }) => <li key={choice.id}>
        <strong>{label} {choice.id} · {choice.text}</strong>
        <p>{choice.explanation}</p>
      </li>)}</ul>
    </div>}
    <dl>
      <dt>正解の決め手</dt><dd>{notes.reason}</dd>
      <dt>AWSの仕様と使い分け</dt><dd>{notes.concept}</dd>
    </dl>
    <details>
      <summary>理解度チェック</summary>
      <p>{notes.check.prompt}</p>
      <details className="learning-answer">
        <summary>考え方を確認</summary>
        <p>{notes.check.answer}</p>
      </details>
    </details>
    <a href={question.source.url} target="_blank" rel="noreferrer">{question.source.label} ↗</a>
  </section>;
}
