import { useCallback, useEffect, useRef, useState } from 'react';
import { LearningNotes } from './LearningNotes';
import type { ExamBlueprint } from './certifications';
import { saveExam, type Attempt } from './history';
import { questionKey, type Question } from './questions';
import {
  canStartExam, getResponse, isAnswered, newExam, readExam, remainingLabel, storeExam,
  type ExamDraft, type ExamResponse,
} from './exam';

type Filter = 'all' | 'unanswered' | 'flagged';

export function ExamMode({ bank, archivedBank, history, onSaved, blueprint, examKey }: {
  bank: Question[];
  archivedBank: Question[];
  blueprint: ExamBlueprint;
  examKey: string;
  history: Attempt[];
  onSaved: (history: Attempt[], indexFailed: boolean) => void;
}) {
  const [draft, setDraft] = useState<ExamDraft>();
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const activeSince = useRef(Date.now());
  const pending = useRef(false);
  const failedAuto = useRef(false);
  const byKey = new Map([...archivedBank, ...bank].map(question => [questionKey(question), question]));
  const questions = draft?.order.map(key => byKey.get(key)).filter(question => question !== undefined) ?? [];
  const correctRevision = draft?.order.length === questions.length;
  const question = questions[draft?.position ?? 0];
  const key = question ? questionKey(question) : '';
  const attempts = draft ? history.filter(attempt => attempt.examId === draft.id) : [];
  const completed = attempts.length > 0;
  const expired = !!draft && now >= draft.deadline;
  const available = canStartExam(bank, blueprint);
  const unanswered = draft ? questions.filter(question => !isAnswered(draft, question)).length : 0;

  useEffect(() => {
    function refresh() {
      try {
        setDraft(readExam(examKey));
        activeSince.current = Date.now();
      } catch {
        setError('受験データを読み込めませんでした。');
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === examKey || event.key === null) refresh();
    }
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [examKey]);

  useEffect(() => {
    if (!draft || completed || expired) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [draft?.id, completed, expired]);

  useEffect(() => {
    if (draft?.position === undefined) return;
    questionHeading.current?.focus();
  }, [draft?.position]);

  const submit = useCallback(async () => {
    if (!draft || !correctRevision || completed || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError('');
    dialog.current?.close();
    try {
      const current = readExam(examKey);
      if (!current || current.id !== draft.id) throw new Error('Stale exam');
      const end = Math.min(Date.now(), current.deadline);
      const result = await saveExam(examKey, current.id, current.deadline, questions.map((question, index) => {
        const response = getResponse(current, questionKey(question));
        return {
          question, selected: response.selected, selectedAt: response.selectedAt,
          durationMs: response.durationMs + (index === current.position ? Math.max(0, end - activeSince.current) : 0),
        };
      }));
      onSaved(result.history, result.indexFailed);
    } catch {
      failedAuto.current = true;
      setError('採点結果を保存できませんでした。保存領域を確認して、採点を再試行してください。');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }, [draft, correctRevision, completed, questions, onSaved, examKey]);

  useEffect(() => {
    if (expired && correctRevision && !completed && !failedAuto.current) void submit();
  }, [expired, correctRevision, completed, submit]);

  function start() {
    if (!available) return;
    try {
      const current = readExam(examKey);
      const currentCompleted = current && history.some(attempt => attempt.examId === current.id);
      if (current && !currentCompleted) {
        setDraft(current);
        return;
      }
      const next = newExam(bank, blueprint);
      storeExam(examKey, next);
      setDraft(next);
      setNow(Date.now());
      activeSince.current = Date.now();
      failedAuto.current = false;
      setFilter('all');
      setShowAll(false);
      setError('');
    } catch {
      setError('受験データを保存できませんでした。');
    }
  }

  function update(position: number, patch: Partial<ExamResponse> = {}) {
    const at = Date.now();
    if (!draft || at >= draft.deadline || pending.current) {
      setNow(at);
      return;
    }
    try {
      const current = readExam(examKey);
      if (!current || current.id !== draft.id || current.position !== draft.position) return;
      const response = getResponse(current, key);
      const next = {
        ...current, position,
        responses: { ...current.responses, [key]: {
          ...response, ...patch, durationMs: response.durationMs + Math.max(0, at - activeSince.current),
        } },
      };
      storeExam(examKey, next);
      activeSince.current = at;
      setDraft(next);
      setError('');
    } catch {
      setError('回答を保存できませんでした。');
    }
  }

  if (completed) return <section className="card">
    <h2>模擬試験の結果</h2>
    <p className="exam-score">{attempts.filter(attempt => attempt.isCorrect).length} / {attempts.length} 問正解</p>
    <p>複数選択は完全一致で採点し、未回答は不正解として集計します。</p>
    <dl className="domain-scores">
      {[...new Set(attempts.map(attempt => attempt.category))].sort().map(category => {
        const items = attempts.filter(attempt => attempt.category === category);
        return <div key={category}><dt>{category}</dt><dd>{items.filter(item => item.isCorrect).length} / {items.length}</dd></div>;
      })}
    </dl>
    <div className="exam-actions"><button className="primary" onClick={start}>もう一度受験する</button>
      <label><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} /> 正解した問題も表示</label></div>
    {error && <p role="alert">{error}</p>}
    <div className="exam-solutions">{attempts.map((attempt, index) => {
      if (!showAll && attempt.isCorrect) return null;
      const item = byKey.get(questionKey({ id: attempt.questionId, revision: attempt.questionRevision }));
      const answered = attempt.selected.length === attempt.correct.length;
      return <details key={attempt.questionId}>
        <summary>第{index + 1}問 · {attempt.isCorrect ? '正解' : answered ? '不正解' : '未回答'} · {item?.title ?? attempt.questionId}</summary>
        <p>{item?.prompt}</p>
        <p>選択 {attempt.selected.join('・') || 'なし'} ／ 正解 {attempt.correct.join('・')}</p>
        {item && <LearningNotes question={item} selected={attempt.selected} />}
        {item && <ul>{item.choices.map(choice => <li key={choice.id}>
          <strong>{choice.id} {attempt.correct.includes(choice.id) ? '正解' : '不正解'} · {choice.text}</strong><br />{choice.explanation}
        </li>)}</ul>}
      </details>;
    })}</div>
  </section>;

  if (!draft) return <section className="card">
    <h2>フル模擬試験</h2>
    <p className="exam-score">{Object.values(blueprint.distribution).reduce((sum, count) => sum + count, 0)}問 / {blueprint.minutes}分</p>
    <p>試験ガイドの4分野に沿った模試。正誤と解説は提出後に表示します。全問の正答率を集計します。</p>
    <p>開始するとカウントダウンが始まり、ページを離れても時間は進みます。</p>
    {!available && <p role="alert">模擬試験に必要な分野別の問題数を満たしていません。</p>}
    <button className="primary" disabled={!available} onClick={start}>模擬試験を開始</button>
    {error && <p role="alert">{error}</p>}
  </section>;

  if (!correctRevision || !question) return <p role="alert">開始時の問題セットを読み込めないため、この試験は再開できません。</p>;

  const response = getResponse(draft, key);
  const count = question.correct.length;
  return <>
    <div className={`exam-bar ${draft.deadline - now <= 300_000 ? 'ending' : ''}`}>
      <div><strong>第 {draft.position + 1} 問 / {questions.length}</strong><br />
        <span>回答済み {questions.length - unanswered} · 未回答 {unanswered}</span></div>
      <div className="exam-clock" role="timer" aria-label="残り時間">{remainingLabel(draft.deadline, now)}</div>
    </div>
    {expired && <p className="notice">制限時間に達しました。</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    <section className="card">
      <div className="question-meta"><span>{count}つ選択</span></div>
      <h2 ref={questionHeading} tabIndex={-1} className="exam-question-title">第{draft.position + 1}問</h2>
      <p className="prompt">{question.prompt}</p>
      <fieldset disabled={expired || submitting}>
        <legend className="sr-only">回答選択肢</legend>
        {question.choices.map(choice => {
          const selected = response.selected.includes(choice.id);
          return <label key={choice.id} className={`choice choice-wrap ${selected ? 'picked' : ''}`}>
            <input type={count === 1 ? 'radio' : 'checkbox'} name="exam-answer" checked={selected}
              disabled={!selected && count > 1 && response.selected.length === count}
              onChange={() => update(draft.position, {
                selected: count === 1 ? [choice.id] : selected
                  ? response.selected.filter(id => id !== choice.id) : [...response.selected, choice.id],
                selectedAt: Date.now(),
              })} />
            <span className="letter">{choice.id}</span><span>{choice.text}</span>
          </label>;
        })}
      </fieldset>
      <div className="exam-actions">
        <button disabled={expired || submitting || !response.selected.length}
          onClick={() => update(draft.position, { selected: [], selectedAt: undefined })}>選択を消す</button>
        <button aria-pressed={response.flagged} disabled={expired || submitting}
          onClick={() => update(draft.position, { flagged: !response.flagged })}>見直しマーク</button>
      </div>
      <div className="exam-actions exam-nav">
        <button disabled={expired || submitting || draft.position === 0}
          onClick={() => update(draft.position - 1)}>前の問題</button>
        <button className="primary" disabled={expired || submitting || draft.position + 1 === questions.length}
          onClick={() => update(draft.position + 1)}>次の問題</button>
      </div>
    </section>
    <section className="card exam-map">
      <h2>問題一覧</h2>
      <label>表示 <select value={filter} onChange={event => setFilter(event.target.value as Filter)}>
        <option value="all">すべて</option><option value="unanswered">未回答のみ</option><option value="flagged">見直しのみ</option>
      </select></label>
      <div className="exam-grid">{questions.map((item, index) => {
        const flagged = getResponse(draft, questionKey(item)).flagged;
        const answered = isAnswered(draft, item);
        if ((filter === 'flagged' && !flagged) || (filter === 'unanswered' && answered)) return null;
        return <button key={item.id} className={answered ? 'answered' : ''} disabled={expired || submitting}
          aria-label={`第${index + 1}問 ${answered ? '回答済み' : '未回答'}${flagged ? ' 見直し' : ''}`}
          aria-current={index === draft.position ? 'step' : undefined}
          onClick={() => update(index)}>{index + 1}{flagged ? ' ⚑' : ''}</button>;
      })}</div>
      <button className="primary" disabled={submitting}
        onClick={() => expired ? void submit() : dialog.current?.showModal()}>{expired ? '採点する' : '試験を提出する'}</button>
    </section>
    <dialog ref={dialog} aria-labelledby="exam-submit">
      <h2 id="exam-submit">模擬試験を提出しますか？</h2>
      <p>未回答 {unanswered}問。提出すると採点結果と解説を表示します。</p>
      <div className="dialog-actions">
        <button autoFocus onClick={() => dialog.current?.close()}>試験に戻る</button>
        <button className="primary" onClick={() => void submit()}>提出する</button>
      </div>
    </dialog>
  </>;
}
