import type { ExamDraft, ExamResponse } from './exam';
import { isAnswered } from './exam';
import type { usePreferences } from './preferences';
import { type Question, questionKey } from './questions';

type Filter = 'all' | 'unanswered' | 'flagged';
type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamNavigation({
  draft,
  questions,
  filter,
  expired,
  submitting,
  unanswered,
  dialog,
  t,
  onFilter,
  onUpdate,
  onSubmit,
}: {
  draft: ExamDraft;
  questions: Question[];
  filter: Filter;
  expired: boolean;
  submitting: boolean;
  unanswered: number;
  dialog: React.RefObject<HTMLDialogElement | null>;
  t: Translate;
  onFilter: (filter: Filter) => void;
  onUpdate: (position: number, patch?: Partial<ExamResponse>) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <section className="card exam-map" aria-busy={submitting}>
        <h2>{t('questionList')}</h2>
        <label>
          {t('show')}{' '}
          <select
            value={filter}
            disabled={expired || submitting}
            onChange={(event) => onFilter(event.target.value as Filter)}
          >
            <option value="all">{t('all')}</option>
            <option value="unanswered">{t('unansweredOnly')}</option>
            <option value="flagged">{t('flaggedOnly')}</option>
          </select>
        </label>
        <div className="exam-grid">
          {questions.map((item, index) => {
            const flagged = (draft.responses[questionKey(item)] ?? { flagged: false }).flagged;
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
                onClick={() => onUpdate(index)}
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
          onClick={() => (expired ? onSubmit() : dialog.current?.showModal())}
        >
          {expired ? t('grade') : t('submitExam')}
        </button>
      </section>
      <dialog ref={dialog} aria-labelledby="exam-submit">
        <h2 id="exam-submit">{t('confirmSubmit')}</h2>
        <p>{t('submissionWarning', { count: unanswered })}</p>
        <div className="dialog-actions">
          <button type="button" disabled={submitting} onClick={() => dialog.current?.close()}>
            {t('backToExam')}
          </button>
          <button type="button" className="primary" disabled={submitting} onClick={onSubmit}>
            {t('submit')}
          </button>
        </div>
      </dialog>
    </>
  );
}

export type { Filter };
