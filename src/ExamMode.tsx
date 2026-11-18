import type { Message } from './messages';
import { usePreferences } from './preferences';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QuestionSetPicker, type QuestionSet } from './QuestionSetPicker';
import { LearningNotes } from './LearningNotes';
import type { ExamBlueprint } from './certifications';
import { saveExam, type Attempt } from './history';
import { questionKey, type Question } from './questions';
import {
  canStartExam,
  getResponse,
  isAnswered,
  newExam,
  readExam,
  remainingLabel,
  storeExam,
  type ExamDraft,
  type ExamResponse,
} from './exam';

type Filter = 'all' | 'unanswered' | 'flagged';

export function ExamMode({
  bank,
  archivedBank,
  history,
  onSaved,
  blueprint,
  examKey,
  sets,
}: {
  bank: Question[];
  sets: QuestionSet[];
  archivedBank: Question[];
  blueprint: ExamBlueprint;
  examKey: string;
  history: Attempt[];
  onSaved: (history: Attempt[], indexFailed: boolean) => void;
}) {
  const { t } = usePreferences();
  const [draft, setDraft] = useState<ExamDraft>();
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState<Message | ''>('');
  const [filter, setFilter] = useState<Filter>('all');
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const activeSince = useRef(Date.now());
  const pending = useRef(false);
  const failedAuto = useRef(false);
  const byKey = new Map(
    [...archivedBank, ...sets.flatMap((set) => set.questions), ...bank].map((question) => [
      questionKey(question),
      question,
    ]),
  );
  const questions =
    draft?.order.map((key) => byKey.get(key)).filter((question) => question !== undefined) ?? [];
  const correctRevision = draft?.order.length === questions.length;
  const question = questions[draft?.position ?? 0];
  const key = question ? questionKey(question) : '';
  const attempts = draft ? history.filter((attempt) => attempt.examId === draft.id) : [];
  const completed = attempts.length > 0;
  const expired = !!draft && now >= draft.deadline;
  const available = canStartExam(bank, blueprint);
  const unanswered = draft ? questions.filter((question) => !isAnswered(draft, question)).length : 0;

  useEffect(() => {
    function refresh() {
      try {
        setDraft(readExam(examKey));
        activeSince.current = Date.now();
      } catch {
        setError('examLoadFailed');
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === examKey || event.key === null) refresh();
    }
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [examKey]);

  const draftId = draft?.id;
  useEffect(() => {
    if (!draftId || completed || expired) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [draftId, completed, expired]);

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
      const result = await saveExam(
        examKey,
        current.id,
        current.deadline,
        questions.map((question, index) => {
          const response = getResponse(current, questionKey(question));
          return {
            question,
            selected: response.selected,
            selectedAt: response.selectedAt,
            durationMs:
              response.durationMs +
              (index === current.position ? Math.max(0, end - activeSince.current) : 0),
          };
        }),
      );
      onSaved(result.history, result.indexFailed);
    } catch {
      failedAuto.current = true;
      setError('examGradeFailed');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }, [draft, correctRevision, completed, questions, onSaved, examKey]);

  useEffect(() => {
    if (expired && correctRevision && !completed && !failedAuto.current) void submit();
  }, [expired, correctRevision, completed, submit]);

  function start(count: number, fixed?: QuestionSet) {
    if (!available && !fixed) return;
    try {
      const current = readExam(examKey);
      const currentCompleted = current && history.some((attempt) => attempt.examId === current.id);
      if (current && !currentCompleted) {
        setDraft(current);
        return;
      }
      const next = newExam(bank, blueprint, Date.now(), count, fixed?.questions);
      storeExam(examKey, next);
      setDraft(next);
      setNow(Date.now());
      activeSince.current = Date.now();
      failedAuto.current = false;
      setFilter('all');
      setShowAll(false);
      setError('');
    } catch {
      setError('examSaveFailed');
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
        ...current,
        position,
        responses: {
          ...current.responses,
          [key]: {
            ...response,
            ...patch,
            durationMs: response.durationMs + Math.max(0, at - activeSince.current),
          },
        },
      };
      storeExam(examKey, next);
      activeSince.current = at;
      setDraft(next);
      setError('');
    } catch {
      setError('answerSaveFailed');
    }
  }

  if (completed)
    return (
      <section className="card">
        <h2>{t('examResults')}</h2>
        <p className="exam-score">
          {t('score', {
            correct: attempts.filter((attempt) => attempt.isCorrect).length,
            total: attempts.length,
          })}
        </p>
        <p>{t('examGrading')}</p>
        <dl className="domain-scores">
          {[...new Set(attempts.map((attempt) => attempt.category))].sort().map((category) => {
            const items = attempts.filter((attempt) => attempt.category === category);
            return (
              <div key={category}>
                <dt>{category}</dt>
                <dd>
                  {items.filter((item) => item.isCorrect).length} / {items.length}
                </dd>
              </div>
            );
          })}
        </dl>
        <QuestionSetPicker bank={bank} sets={sets} onStart={start} buttonLabel={t('nextExam')} />
        <div className="exam-actions">
          <label>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />{' '}
            {t('includeCorrect')}
          </label>
        </div>
        {error && <p role="alert">{t(error)}</p>}
        <div className="exam-solutions">
          {attempts.map((attempt, index) => {
            if (!showAll && attempt.isCorrect) return null;
            const item = byKey.get(
              questionKey({ id: attempt.questionId, revision: attempt.questionRevision }),
            );
            const answered = attempt.selected.length === attempt.correct.length;
            return (
              <details key={attempt.questionId}>
                <summary>
                  {t('questionNumber', { number: index + 1 })} ·{' '}
                  {attempt.isCorrect ? t('correct') : answered ? t('incorrect') : t('unanswered')} ·{' '}
                  {item?.title ?? attempt.questionId}
                </summary>
                <p>{item?.prompt}</p>
                <p>
                  {t('selected')} {attempt.selected.join('・') || t('none')} ／ {t('correct')}{' '}
                  {attempt.correct.join('・')}
                </p>
                {item && <LearningNotes question={item} selected={attempt.selected} />}
                {item && (
                  <ul>
                    {item.choices.map((choice) => (
                      <li key={choice.id}>
                        <strong>
                          {choice.id}{' '}
                          {attempt.correct.includes(choice.id) ? t('correct') : t('incorrect')} ·{' '}
                          {choice.text}
                        </strong>
                        <br />
                        {choice.explanation}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            );
          })}
        </div>
      </section>
    );

  if (!draft)
    return (
      <section className="card">
        <h2>{t('examSetup')}</h2>
        <p className="exam-score">
          {t('examLength', {
            count: Object.values(blueprint.distribution).reduce((sum, count) => sum + count, 0),
            minutes: blueprint.minutes,
          })}
        </p>
        <p>{t('examTiming')}</p>
        <p>{t('examTimerWarning')}</p>
        {!available && <p role="alert">{t('tooFew')}</p>}
        <QuestionSetPicker bank={bank} sets={sets} onStart={start} buttonLabel={t('startExam')} />
        {error && <p role="alert">{t(error)}</p>}
      </section>
    );

  if (!correctRevision || !question) return <p role="alert">{t('cannotResume')}</p>;

  const response = getResponse(draft, key);
  const count = question.correct.length;
  return (
    <>
      <div className={`exam-bar ${draft.deadline - now <= 300_000 ? 'ending' : ''}`}>
        <div>
          <strong>{t('position', { current: draft.position + 1, total: questions.length })}</strong>
          <br />
          <span>
            {t('answered')} {questions.length - unanswered} · {t('unanswered')} {unanswered}
          </span>
        </div>
        <div className="exam-clock" role="timer" aria-label={t('remaining')}>
          {remainingLabel(draft.deadline, now)}
        </div>
      </div>
      {expired && <p className="notice">{t('expired')}</p>}
      {error && (
        <p className="notice" role="alert">
          {t(error)}
        </p>
      )}
      <section className="card">
        <div className="question-meta">
          <span>{t('choose', { count })}</span>
        </div>
        <h2 ref={questionHeading} tabIndex={-1} className="exam-question-title">
          {t('questionNumber', { number: draft.position + 1 })}
        </h2>
        <p className="prompt" lang="ja">
          {question.prompt}
        </p>
        <fieldset disabled={expired || submitting}>
          <legend className="sr-only">{t('choices')}</legend>
          {question.choices.map((choice) => {
            const selected = response.selected.includes(choice.id);
            return (
              <label key={choice.id} className={`choice choice-wrap ${selected ? 'picked' : ''}`}>
                <input
                  type={count === 1 ? 'radio' : 'checkbox'}
                  name="exam-answer"
                  checked={selected}
                  disabled={!selected && count > 1 && response.selected.length === count}
                  onChange={() =>
                    update(draft.position, {
                      selected:
                        count === 1
                          ? [choice.id]
                          : selected
                            ? response.selected.filter((id) => id !== choice.id)
                            : [...response.selected, choice.id],
                      selectedAt: Date.now(),
                    })
                  }
                />
                <span className="letter">{choice.id}</span>
                <span lang="ja">{choice.text}</span>
              </label>
            );
          })}
        </fieldset>
        <div className="exam-actions">
          <button
            type="button"
            disabled={expired || submitting || !response.selected.length}
            onClick={() => update(draft.position, { selected: [], selectedAt: undefined })}
          >
            {t('clearChoice')}
          </button>
          <button
            type="button"
            aria-pressed={response.flagged}
            disabled={expired || submitting}
            onClick={() => update(draft.position, { flagged: !response.flagged })}
          >
            {t('flag')}
          </button>
        </div>
        <div className="exam-actions exam-nav">
          <button
            type="button"
            disabled={expired || submitting || draft.position === 0}
            onClick={() => update(draft.position - 1)}
          >
            {t('previous')}
          </button>
          <button
            type="button"
            className="primary"
            disabled={expired || submitting || draft.position + 1 === questions.length}
            onClick={() => update(draft.position + 1)}
          >
            {t('nextExamQuestion')}
          </button>
        </div>
      </section>
      <section className="card exam-map">
        <h2>{t('questionList')}</h2>
        <label>
          {t('show')}{' '}
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            <option value="all">{t('all')}</option>
            <option value="unanswered">{t('unansweredOnly')}</option>
            <option value="flagged">{t('flaggedOnly')}</option>
          </select>
        </label>
        <div className="exam-grid">
          {questions.map((item, index) => {
            const flagged = getResponse(draft, questionKey(item)).flagged;
            const answered = isAnswered(draft, item);
            if ((filter === 'flagged' && !flagged) || (filter === 'unanswered' && answered)) return null;
            return (
              <button
                type="button"
                key={item.id}
                className={answered ? 'answered' : ''}
                disabled={expired || submitting}
                aria-label={`${t('questionNumber', { number: index + 1 })} ${answered ? t('answered') : t('unanswered')}${flagged ? ` ${t('flagged')}` : ''}`}
                aria-current={index === draft.position ? 'step' : undefined}
                onClick={() => update(index)}
              >
                {index + 1}
                {flagged ? ' ⚑' : ''}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="primary"
          disabled={submitting}
          onClick={() => (expired ? void submit() : dialog.current?.showModal())}
        >
          {expired ? t('grade') : t('submitExam')}
        </button>
      </section>
      <dialog ref={dialog} aria-labelledby="exam-submit">
        <h2 id="exam-submit">{t('confirmSubmit')}</h2>
        <p>{t('submissionWarning', { count: unanswered })}</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            {t('backToExam')}
          </button>
          <button type="button" className="primary" onClick={() => void submit()}>
            {t('submit')}
          </button>
        </div>
      </dialog>
    </>
  );
}
