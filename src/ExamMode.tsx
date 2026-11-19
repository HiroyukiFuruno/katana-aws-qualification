import { useEffect, useRef, useState } from 'react';
import type { ExamBlueprint } from './certifications';
import { getResponse, remainingLabel } from './exam';
import { ExamFormatPicker } from './ExamFormatPicker';
import { ExamNavigation, type Filter } from './ExamNavigation';
import { ExamQuestion } from './ExamQuestion';
import { ExamResults } from './ExamResults';
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
}: {
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
    onStart() {
      setFilter('all');
      setShowAll(false);
    },
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
    attempts,
    completed,
    expired,
    available,
    unanswered,
    submitting,
    dialog,
    submit,
    start,
    update,
  } = session;
  useEffect(() => {
    if (draft?.position !== undefined) questionHeading.current?.focus();
  }, [draft?.position]);

  if (completed)
    return (
      <ExamResults
        attempts={attempts}
        byKey={byKey}
        blueprint={blueprint}
        available={available}
        error={error}
        showAll={showAll}
        onShowAll={setShowAll}
        onStart={start}
        t={t}
      />
    );
  if (!draft)
    return (
      <section className="card">
        <h2>{t('examSetup')}</h2>
        <p>{t('examTiming')}</p>
        <p>{t('examTimerWarning')}</p>
        {!available && <p role="alert">{t('tooFew')}</p>}
        <ExamFormatPicker
          blueprint={blueprint}
          available={available}
          onStart={start}
          buttonLabel={t('startExam')}
        />
        {error && <p role="alert">{t(error)}</p>}
      </section>
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
      {error && (
        <p className="notice" role="alert">
          {t(error)}
        </p>
      )}
      <ExamQuestion
        draft={draft}
        question={question}
        response={response}
        expired={expired}
        submitting={submitting}
        t={t}
        heading={questionHeading}
        onUpdate={update}
      />
      <ExamNavigation
        draft={draft}
        questions={questions}
        filter={filter}
        expired={expired}
        submitting={submitting}
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
