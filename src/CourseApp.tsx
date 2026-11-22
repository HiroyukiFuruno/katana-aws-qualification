import { useMemo } from 'react';
import { AccountBenefits } from './auth/AccountBenefits';
import { CourseNavigation, CourseOverview } from './CourseNavigation';
import { CoursePractice } from './CoursePractice';
import { CourseSettings } from './CourseSettings';
import type { Course } from './certifications';
import { ExamMode } from './ExamMode';
import { selectExamQuestions } from './exam';
import { examKeyFor } from './history';
import { usePreferences } from './preferences';
import { QuestionTranslationNotice } from './QuestionTranslationNotice';
import { useCourseBanks } from './useCourseBanks';
import { useCourseProgress } from './useCourseProgress';

export function CourseApp({ id, name, course }: { id: string; name: string; course: Course }) {
  const { t } = usePreferences();
  const banks = useCourseBanks(course);
  const {
    questions,
    questionSets,
    randomBank,
    mockBank,
    archivedBank,
    loadingError,
    mockError,
    sourceOnlyLocales,
    ready: banksReady,
  } = banks;
  const progressQuestions = useMemo(() => [...questions, ...mockBank], [questions, mockBank]);
  const progress = useCourseProgress(id, progressQuestions, archivedBank);
  const { answerCount, rate, review, notice, busy, page, navigate } = progress;
  const ready = banksReady && !progress.translationError;
  const contentError = progress.translationError ? 'invalidQuestionData' : (loadingError ?? mockError);

  function section() {
    if (page === 'settings') {
      return (
        <CourseSettings count={answerCount} onReset={progress.reset} onExport={progress.download} />
      );
    }
    if (page === 'exam') {
      const error = mockError ?? loadingError;
      if (error && !mockBank.length) return <p role="alert">{t(error)}</p>;
      if (!mockBank.length || !questions.length) return <p role="status">{t('loadingExam')}</p>;
      return (
        <ExamMode
          practiceQuestions={questions}
          examKey={examKeyFor(course.examStorageId ?? id)}
          blueprint={course.exam}
          bank={mockBank}
          archivedBank={archivedBank}
          history={progress.history}
          onSaved={progress.updateExamHistory}
          certificationId={id}
        />
      );
    }
    if (loadingError && !questions.length) {
      return (
        <p className="notice" role="alert">
          {t(loadingError)}
        </p>
      );
    }
    if (!questions.length) return <p role="status">{t('loadingQuestions')}</p>;

    const sets =
      course.fixedExamFromBlueprint && !progress.session && page === 'study'
        ? [{ label: t('saaFull'), questions: selectExamQuestions(mockBank, course.exam) }]
        : questionSets;
    return (
      <CoursePractice
        mode={page}
        session={progress.session}
        question={progress.question}
        review={review}
        randomBank={randomBank}
        sets={sets}
        start={progress.start}
        next={progress.next}
        close={progress.close}
        answer={progress.answer}
      />
    );
  }

  return (
    <>
      <CourseNavigation page={page} busy={busy} onNavigate={navigate} />
      <main className="shell" id="main">
        <CourseOverview
          id={id}
          name={name}
          page={page}
          answerCount={answerCount}
          rate={rate}
          wrongCount={review.length}
          notice={notice}
          contentLocalized={banksReady && sourceOnlyLocales.length === 0}
        />
        {banksReady && <QuestionTranslationNotice sourceLocales={sourceOnlyLocales} />}
        {!ready && (
          <p role={contentError ? 'alert' : 'status'}>{t(contentError ?? 'loadingQuestions')}</p>
        )}
        <div style={{ display: ready ? 'contents' : 'none' }} inert={!ready}>
          {section()}
        </div>
        {page !== 'exam' && !progress.session && <AccountBenefits context="study" showAction />}
      </main>
    </>
  );
}
