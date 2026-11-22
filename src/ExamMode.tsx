import { useEffect, useRef, useState } from 'react';
import type { ExamBlueprint } from './certifications';
import { ExamNavigation, type Filter } from './ExamNavigation';
import { ExamQuestion } from './ExamQuestion';
import { ExamResults } from './ExamResults';
import { ExamResultsButton } from './ExamResultsButton';
import { ExamSaveError } from './ExamSaveError';
import { ExamSetup } from './ExamSetup';
import { getResponse, remainingLabel } from './exam';
import type { Attempt } from './history';
import { usePreferences } from './preferences';
import type { Question } from './questions';
import { useExamSession } from './useExamSession';

export function ExamMode({
  bank,
  archivedBank,
  history,
  onSaved,
  blueprint,
  examKey,
  practiceQuestions,
  certificationId,
}: {
  certificationId: string;
  bank: Question[];
  practiceQuestions: Question[];
  archivedBank: Question[];
  blueprint: ExamBlueprint;
  examKey: string;
  history: Attempt[];
  onSaved: (history: Attempt[], indexFailed: boolean) => void;
}) {
  const { t } = usePreferences();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const session = useExamSession({
    bank,
    archivedBank,
    history,
    onSaved,
    blueprint,
    examKey,
    practiceQuestions,
    onStart: () => {
      setFilter('all');
      setShowAll(false);
    },
    certificationId,
  });
  const {
    draft,
    now,
    error,
    byKey,
    questions,
    correctRevision,
    question,
    key,
    choiceOrder,
    attempts,
    completed,
    expired,
    available,
    unanswered,
    dialog,
    submit,
    start,
    update,
    saving,
  } = session;
  const busy = session.submitting || saving || session.reloading;
  useEffect(() => {
    if (draft?.position !== undefined) questionHeading.current?.focus();
  }, [draft?.position]);

  if (completed)
    return (
      <ExamResults
        attempts={attempts}
        byKey={byKey}
        choiceOrders={draft?.choiceOrders}
        blueprint={blueprint}
        available={available}
        saving={busy}
        error={error}
        showAll={showAll}
        onShowAll={setShowAll}
        onStart={start}
        t={t}
      />
    );
  if (!draft)
    return (
      <>
        <ExamSetup
          blueprint={blueprint}
          available={available}
          saving={busy}
          onStart={start}
          error={error}
          t={t}
        />
        {history.some((attempt) => attempt.mode === 'exam' && attempt.examId) ? (
          <ExamResultsButton disabled={busy} onClick={() => void session.loadSubmittedExam()} t={t} />
        ) : null}
      </>
    );
  if (!correctRevision || !question) return <p role="alert">{t('cannotResume')}</p>;
  const response = getResponse(draft, key);
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
      <ExamSaveError busy={busy} error={error} onReload={session.reload} t={t} />
      <ExamQuestion
        draft={draft}
        question={question}
        choiceOrder={choiceOrder}
        response={response}
        expired={expired}
        submitting={busy}
        t={t}
        heading={questionHeading}
        onUpdate={update}
      />
      <ExamNavigation
        draft={draft}
        questions={questions}
        filter={filter}
        expired={expired}
        submitting={busy}
        unanswered={unanswered}
        dialog={dialog}
        t={t}
        onFilter={setFilter}
        onUpdate={update}
        onSubmit={() => void submit()}
      />
    </>
  );
}
