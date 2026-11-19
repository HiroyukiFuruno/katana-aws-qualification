import { shuffle } from './exam';
import type { Attempt, Mode } from './history';
import { usePreferences } from './preferences';
import { QuestionCard } from './QuestionCard';
import { QuestionSetPicker, type QuestionSet } from './QuestionSetPicker';
import { questionKey, type Question } from './questions';
import type { PracticeSession } from './useCourseProgress';

type ReviewItem = { question: Question; wrong: number; lastReview?: Attempt };

export function CoursePractice({
  mode,
  session,
  question,
  review,
  randomBank,
  sets,
  start,
  next,
  close,
  answer,
}: {
  mode: Mode;
  session: PracticeSession | undefined;
  question: Question | undefined;
  review: ReviewItem[];
  randomBank: Question[];
  sets: QuestionSet[];
  start: (questions: Question[]) => void;
  next: () => void;
  close: () => void;
  answer: (selected: string[], elapsed: number) => Promise<Attempt>;
}) {
  const { t } = usePreferences();
  if (session && question) {
    return (
      <>
        <div className="progress">
          <span>{t('position', { current: session.index + 1, total: session.questions.length })}</span>
          <progress
            max={session.questions.length}
            value={session.index + 1}
            aria-label={t('questionPosition')}
          />
        </div>
        <QuestionCard
          key={questionKey(question)}
          question={question}
          onAnswer={answer}
          last={session.index + 1 === session.questions.length}
          onNext={next}
        />
      </>
    );
  }
  if (session) {
    return (
      <section className="card">
        <h2>{t('results')}</h2>
        <p>{t('score', { correct: session.correct, total: session.questions.length })}</p>
        <button type="button" className="primary" onClick={close}>
          {mode === 'review' ? t('backReview') : t('backStudy')}
        </button>
      </section>
    );
  }
  if (mode === 'review') return <ReviewQueue review={review} start={start} />;

  return (
    <section className="card">
      <h2>{t('questionSets')}</h2>
      <QuestionSetPicker
        maxCount={randomBank.length}
        sets={sets}
        buttonLabel={t('startStudy')}
        onStart={(count, fixed) => start(fixed?.questions ?? shuffle(randomBank).slice(0, count))}
      />
      <p>
        <a
          href="https://aws.amazon.com/certification/certification-prep/"
          target="_blank"
          rel="noreferrer"
        >
          {t('officialPractice')}
        </a>
      </p>
    </section>
  );
}

function ReviewQueue({
  review,
  start,
}: {
  review: ReviewItem[];
  start: (questions: Question[]) => void;
}) {
  const { t } = usePreferences();
  return (
    <section className="card">
      <h2>{t('reviewQueue')}</h2>
      {review.length ? (
        <>
          <ol className="review-list">
            {review.map(({ question, wrong, lastReview }) => (
              <li key={questionKey(question)}>
                <span>{question.title}</span>
                <span>
                  {t('missedCount', { count: wrong })} ·{' '}
                  {lastReview
                    ? lastReview.isCorrect
                      ? t('lastReviewCorrect')
                      : t('lastReviewIncorrect')
                    : t('notReviewed')}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="primary"
            onClick={() => start(review.map((item) => item.question))}
          >
            {t('startReview')}
          </button>
        </>
      ) : (
        <p>{t('noReview')}</p>
      )}
    </section>
  );
}
