import { AnalyticsSettings, initializeAnalytics } from './AnalyticsSettings';
import { CertificationPages } from './CertificationPages';
import type { Message } from './messages';
import { usePreferences, PreferencesProvider } from './preferences';
import { SiteFooter } from './SiteFooter';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { certifications, type Course } from './certifications';
import { Roadmap } from './Roadmap';
import { FundamentalsPage, Home, NotFound, SiteHeader, StudyDirectory, StudyPaths } from './SitePages';
import { localePath } from './locales';
import { GlossaryPage } from './GlossaryPage';
import { routeAt } from './routes';
import { QuestionSetPicker, type QuestionSet } from './QuestionSetPicker';
import { selectExamQuestions, shuffle } from './exam';
import { ExamMode } from './ExamMode';
import { QuestionCard } from './QuestionCard';
import {
  examKeyFor,
  exportHistory,
  historyKey,
  readHistory,
  resetHistory,
  saveAttempt,
  statsFor,
  type Attempt,
  type Mode,
} from './history';
import { loadQuestions, questionKey, type Question } from './questions';
import './style.css';

type Page = Mode | 'exam' | 'settings';
type Session = { questions: Question[]; index: number; correct: number };

const courseMenuIcons = {
  study: <path d="M12 6v15M3 4h5c2 0 4 1 4 2 0-1 2-2 4-2h5v15h-5c-2 0-4 1-4 2 0-1-2-2-4-2H3z" />,
  exam: (
    <>
      <circle cx="12" cy="14" r="8" />
      <path d="M9 2h6m4 5 2-2m-9 5v4l2 2" />
    </>
  ),
  review: <path d="M3 5v6h6m-6 0a9 9 0 1 1 2 7" />,
  settings: <path d="M4 6h4m4 0h8M4 12h9m4 0h3M4 18h3m4 0h9M8 4v4m9 2v4m-6 2v4" />,
};

function Settings({
  count,
  onReset,
  onExport,
}: {
  count: number;
  onReset: () => Promise<void>;
  onExport: () => void;
}) {
  const { t } = usePreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  async function confirmReset() {
    setBusy(true);
    dialog.current?.close();
    try {
      await onReset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>{t('learningData')}</h2>
      <p>{t('savedAnswers', { count })}</p>
      <button type="button" className="primary" disabled={!count || busy} onClick={onExport}>
        {t('export')}
      </button>
      <hr />
      <h3>{t('resetTitle')}</h3>
      <p>{t('resetDescription')}</p>
      <button
        type="button"
        className="danger"
        disabled={busy}
        onClick={() => dialog.current?.showModal()}
      >
        {t('reset')}
      </button>
      <dialog ref={dialog} aria-labelledby="reset-title">
        <h2 id="reset-title">{t('confirmReset')}</h2>
        <p>{t('resetWarning')}</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            {t('cancel')}
          </button>
          <button type="button" className="danger" onClick={() => void confirmReset()}>
            {t('delete')}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function CourseApp({ id, name, course }: { id: string; name: string; course: Course }) {
  const { t, locale } = usePreferences();
  const [practiceSets, setPracticeSets] = useState<{ label: Message; questions: Question[] }[]>([]);
  const questions = practiceSets.flatMap((set) => set.questions);
  const questionSets: QuestionSet[] = practiceSets.flatMap((set) => {
    const label = t(set.label);
    const size = course.setSize;
    if (!size) return [{ ...set, label }];
    return Array.from({ length: Math.ceil(set.questions.length / size) }, (_, index) => ({
      label: t('numberedSet', { label, number: index + 1 }),
      questions: set.questions.slice(index * size, (index + 1) * size),
    }));
  });
  const randomBank = [
    ...new Map(questions.map((question) => [questionKey(question), question])).values(),
  ];

  const [mockBank, setMockBank] = useState<Question[]>([]);
  const [archivedBank, setArchivedBank] = useState<Question[]>([]);
  const [mockError, setMockError] = useState<'' | 'invalidQuestionData' | 'loadQuestionError'>('');
  const [history, setHistory] = useState<Attempt[]>([]);
  const [page, setPage] = useState<Page>('study');
  const [session, setSession] = useState<Session>();
  const [loadingError, setLoadingError] = useState<'' | 'invalidQuestionData' | 'loadQuestionError'>('');
  const [notice, setNotice] = useState<Message | ''>('');
  const [busy, setBusy] = useState(false);
  const question = session?.questions[session.index];
  const knownQuestions = new Map(
    [...questions, ...mockBank].map((question) => [questionKey(question), question]),
  );
  const courseIds = new Set(
    [...knownQuestions.values(), ...archivedBank].map((question) => question.id),
  );
  const courseHistory = history.filter((attempt) => courseIds.has(attempt.questionId));
  const summaries = [...knownQuestions.values()].map((question) => ({
    question,
    ...statsFor(courseHistory, question),
  }));
  const review = summaries.filter((stats) => stats.wrong > 0).sort((a, b) => b.wrong - a.wrong);
  const rate = courseHistory.length
    ? `${Math.round((100 * courseHistory.filter((a) => a.isCorrect).length) / courseHistory.length)}%`
    : '—';

  useEffect(() => {
    const banks = new Map<string, Promise<Question[]>>();
    function load(path: string) {
      const cached = banks.get(path);
      if (cached) return cached;
      const request = loadQuestions(path);
      banks.set(path, request);
      return request;
    }
    Promise.all(course.practice.map(async ({ path, label }) => ({ label, questions: await load(path) })))
      .then(setPracticeSets)
      .catch((error) =>
        setLoadingError(
          error instanceof Error && error.message === 'invalidQuestionData'
            ? 'invalidQuestionData'
            : 'loadQuestionError',
        ),
      );
    Promise.all([load(course.mock), Promise.all(course.archives.map(load))])
      .then(([current, archived]) => {
        setMockBank(current);
        setArchivedBank(archived.flat());
      })
      .catch((error) =>
        setMockError(
          error instanceof Error && error.message === 'invalidQuestionData'
            ? 'invalidQuestionData'
            : 'loadQuestionError',
        ),
      );
    function refresh() {
      try {
        setHistory(readHistory());
      } catch {
        setNotice('historyFailed');
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === historyKey || event.key === null) {
        refresh();
        if (event.newValue === null) setSession(undefined);
      }
    }
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [course]);

  const pages = [
    ['study', t('learnFromQuestions')],
    ['exam', t('exam')],
    ['review', t('review')],
    ['settings', t('settings')],
  ] as const;
  const start = (items: Question[]) => setSession({ questions: items, index: 0, correct: 0 });

  async function answer(selected: string[], elapsed: number) {
    if (!question || (page !== 'study' && page !== 'review')) throw new Error(t('questionMissing'));
    setBusy(true);
    try {
      const result = await saveAttempt(question, selected, page, elapsed);
      setHistory(result.history);
      setSession(
        (current) => current && { ...current, correct: current.correct + result.attempt.reward },
      );
      if (result.indexFailed) setNotice('wrongIndexFailed');
      return result.attempt;
    } finally {
      setBusy(false);
    }
  }

  function updateExamHistory(updated: Attempt[], indexFailed: boolean) {
    setHistory(updated);
    if (indexFailed) setNotice('wrongIndexFailed');
  }

  async function reset() {
    setBusy(true);
    try {
      await resetHistory();
      setHistory([]);
      setSession(undefined);
      setPage('study');
      setNotice('resetDone');
    } catch {
      setNotice('resetFailed');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    try {
      const current = readHistory().filter((attempt) => courseIds.has(attempt.questionId));
      if (current.length) exportHistory(current);
    } catch {
      setNotice('exportFailed');
    }
  }

  return (
    <>
      <div className="course-nav">
        <nav className="shell" aria-label={t('studyMenu')}>
          {pages.map(([id, label]) => (
            <button
              type="button"
              key={id}
              disabled={busy}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => {
                if (page !== id) {
                  setPage(id);
                  setSession(undefined);
                  setNotice('');
                }
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {courseMenuIcons[id]}
              </svg>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <main className="shell" id="main">
        <div className="intro">
          <p className="eyebrow">
            {name} · {id.toUpperCase()}
          </p>
          <h1>{pages.find(([id]) => page === id)?.[1]}</h1>
          {page === 'study' && <p>{t('studyIntro')}</p>}
          {page === 'review' && <p>{t('reviewIntro')}</p>}
        </div>
        {locale !== 'ja' && <p>{t('contentLanguage')}</p>}
        <section className="metrics" aria-label={t('progress')}>
          <div>
            <span>{t('answerCount')}</span>
            <strong>{courseHistory.length}</strong>
          </div>
          <div>
            <span>{t('accuracy')}</span>
            <strong>{rate}</strong>
          </div>
          <div>
            <span>{t('wrongCount')}</span>
            <strong>{review.length}</strong>
          </div>
        </section>
        {notice && (
          <p className="notice" role="status">
            {t(notice)}
          </p>
        )}
        {page === 'settings' ? (
          <Settings count={courseHistory.length} onReset={reset} onExport={download} />
        ) : page === 'exam' ? (
          mockError || loadingError ? (
            <p role="alert">
              {(mockError || loadingError) && t(mockError || loadingError || 'loadQuestionError')}
            </p>
          ) : mockBank.length && questions.length ? (
            <ExamMode
              sets={
                course.fixedExamFromBlueprint
                  ? [
                      {
                        label: t('numberedSet', { label: t('shortExam'), number: 1 }),
                        questions: selectExamQuestions(mockBank, course.exam),
                      },
                    ]
                  : questionSets
              }
              examKey={examKeyFor(course.examStorageId ?? id)}
              blueprint={course.exam}
              bank={mockBank}
              archivedBank={archivedBank}
              history={history}
              onSaved={updateExamHistory}
            />
          ) : (
            <p role="status">{t('loadingExam')}</p>
          )
        ) : loadingError ? (
          <p className="notice" role="alert">
            {t(loadingError)}
          </p>
        ) : !questions.length ? (
          <p role="status">{t('loadingQuestions')}</p>
        ) : session && question ? (
          <>
            <div className="progress">
              <span>
                {t('position', { current: session.index + 1, total: session.questions.length })}
              </span>
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
              onNext={() => setSession((current) => current && { ...current, index: current.index + 1 })}
            />
          </>
        ) : session ? (
          <section className="card">
            <h2>{t('results')}</h2>
            <p>{t('score', { correct: session.correct, total: session.questions.length })}</p>
            <button type="button" className="primary" onClick={() => setSession(undefined)}>
              {page === 'review' ? t('backReview') : t('backStudy')}
            </button>
          </section>
        ) : page === 'review' ? (
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
        ) : (
          <section className="card">
            <h2>{t('questionSets')}</h2>
            <QuestionSetPicker
              maxCount={randomBank.length}
              sets={
                course.fixedExamFromBlueprint
                  ? [
                      {
                        label: t('numberedSet', { label: t('shortExam'), number: 1 }),
                        questions: selectExamQuestions(mockBank, course.exam),
                      },
                    ]
                  : questionSets
              }
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
        )}
      </main>
    </>
  );
}

function App() {
  useEffect(initializeAnalytics, []);
  const { t, locale } = usePreferences();
  const route = routeAt(location.pathname);
  if (!route) return <NotFound />;
  const [section, courseId] = route.page.split('/');
  const selected = section === 'study' ? certifications.find((cert) => cert.id === courseId) : undefined;

  return (
    <>
      <SiteHeader section={section} subpage={courseId} />
      {selected?.course ? (
        <CourseApp id={selected.id} name={selected.name} course={selected.course} />
      ) : section === 'study' && courseId === 'questions' ? (
        <StudyDirectory />
      ) : section === 'study' && courseId === 'fundamentals' ? (
        <FundamentalsPage />
      ) : section === 'study' ? (
        <StudyPaths />
      ) : section === 'certifications' ? (
        <CertificationPages id={courseId} />
      ) : section === 'glossary' ? (
        <GlossaryPage />
      ) : section === 'privacy' ? (
        <main className="shell" id="main">
          <h1>{t('privacy')}</h1>
          <AnalyticsSettings />
        </main>
      ) : section === 'assessment' ? (
        <main className="shell" id="main">
          <div className="intro">
            <h1>{t('skillsAssessment')}</h1>
            <p>{t('roadmapIntro')}</p>
          </div>
          <Roadmap onStudy={(id) => location.assign(localePath(locale, `study/${id}`))} />
        </main>
      ) : (
        <Home />
      )}
      <SiteFooter />
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root missing');
createRoot(root).render(
  <PreferencesProvider>
    <App />
  </PreferencesProvider>,
);
