import { useState } from 'react';
import type { Question } from './questions';

export type QuestionSet = { label: string; questions: Question[] };

export function QuestionSetPicker({ bank, sets, onStart, buttonLabel }: {
  bank: Question[];
  sets: QuestionSet[];
  onStart: (count: number, fixed?: QuestionSet) => void;
  buttonLabel: string;
}) {
  const [selection, setSelection] = useState('random');
  const counts = Array.from({ length: bank.length }, (_, index) => index + 1);
  const [count, setCount] = useState(Math.min(10, bank.length));
  const fixed = selection === 'random' ? undefined : sets[Number(selection)];

  return <div className="question-set-picker">
    <label>出題方法
      <select value={selection} onChange={event => setSelection(event.target.value)}>
        <option value="random">ランダム出題</option>
        {sets.map((set, index) =>
          <option key={set.label} value={index}>{set.label}（{set.questions.length}問）</option>)}
      </select>
    </label>
    {!fixed && <label>問題数
      <select value={count} onChange={event => setCount(Number(event.target.value))}>
        {counts.map(value => <option key={value} value={value}>{value}問</option>)}
      </select>
    </label>}
    <button className="primary" disabled={!bank.length}
      onClick={() => onStart(fixed?.questions.length ?? count, fixed)}>{buttonLabel}</button>
  </div>;
}
