import { useEffect, useMemo, useState } from 'react';
import type { Course } from './certifications';
import type { Locale } from './locales';
import { usePreferences } from './preferences';
import { type LoadedQuestionBank, loadQuestionBank } from './questionLocalization';
import { questionKey } from './questions';

type LoadedPractice = Omit<Course['practice'][number], 'path'> & LoadedQuestionBank;
type LoadError = 'invalidQuestionData' | 'loadQuestionError';

function errorKey(error: unknown): LoadError {
  return error instanceof Error && error.message === 'invalidQuestionData'
    ? 'invalidQuestionData'
    : 'loadQuestionError';
}

export function useCourseBanks(course: Course) {
  const { locale, t } = usePreferences();
  const [practiceSets, setPracticeSets] = useState<LoadedPractice[]>([]);
  const [mockResult, setMockResult] = useState<LoadedQuestionBank>();
  const [archiveResults, setArchiveResults] = useState<LoadedQuestionBank[]>([]);
  const [loadingError, setLoadingError] = useState<LoadError>();
  const [mockError, setMockError] = useState<LoadError>();
  const [practiceLocale, setPracticeLocale] = useState<Locale>();
  const [mockLocale, setMockLocale] = useState<Locale>();

  useEffect(() => {
    let cancelled = false;
    setLoadingError(undefined);
    setMockError(undefined);
    setPracticeLocale(undefined);
    setMockLocale(undefined);
    const requests = new Map<string, Promise<LoadedQuestionBank>>();
    function load(path: string) {
      const cached = requests.get(path);
      if (cached) return cached;
      const request = loadQuestionBank(path, locale);
      requests.set(path, request);
      return request;
    }

    Promise.all(course.practice.map(async ({ path, ...set }) => ({ ...set, ...(await load(path)) })))
      .then((sets) => {
        if (!cancelled) {
          setPracticeSets(sets);
          setPracticeLocale(locale);
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadingError(errorKey(error));
      });
    Promise.all([load(course.mock), Promise.all(course.archives.map(load))])
      .then(([current, archived]) => {
        if (cancelled) return;
        setMockResult(current);
        setArchiveResults(archived);
        setMockLocale(locale);
      })
      .catch((error) => {
        if (!cancelled) setMockError(errorKey(error));
      });
    return () => {
      cancelled = true;
    };
  }, [course, locale]);

  const questions = useMemo(() => practiceSets.flatMap((set) => set.questions), [practiceSets]);
  const mockBank = useMemo(() => mockResult?.questions ?? [], [mockResult]);
  const archivedBank = useMemo(
    () => archiveResults.flatMap((result) => result.questions),
    [archiveResults],
  );
  const sourceOnlyLocales = useMemo(
    () =>
      [...practiceSets, mockResult, ...archiveResults]
        .filter((result): result is LoadedQuestionBank => !!result?.pendingLocale)
        .map((result) => result.contentLocale)
        .filter((locale, index, locales) => locales.indexOf(locale) === index),
    [archiveResults, mockResult, practiceSets],
  );
  const questionSets = practiceSets.flatMap((set) => {
    const label = t(set.label);
    const size = course.setSize;
    if (set.fixedCount) return [{ label, questions: set.questions.slice(0, set.fixedCount) }];
    if (!size) return [{ ...set, label }];
    return Array.from({ length: Math.ceil(set.questions.length / size) }, (_, index) => ({
      label: t('numberedSet', { label, number: index + 1 }),
      questions: set.questions.slice(index * size, (index + 1) * size),
    }));
  });
  const randomBank = useMemo(
    () => [...new Map(questions.map((question) => [questionKey(question), question])).values()],
    [questions],
  );
  return {
    questions,
    questionSets,
    randomBank,
    mockBank,
    archivedBank,
    ready: practiceLocale === locale && mockLocale === locale,
    loadingError,
    mockError,
    sourceOnlyLocales,
  };
}
