import { useEffect, useState } from 'react';
import type { Course } from './certifications';
import { usePreferences } from './preferences';
import { loadQuestions, questionKey, type Question } from './questions';

type LoadedPractice = Omit<Course['practice'][number], 'path'> & { questions: Question[] };
type LoadError = 'invalidQuestionData' | 'loadQuestionError';

function errorKey(error: unknown): LoadError {
  return error instanceof Error && error.message === 'invalidQuestionData'
    ? 'invalidQuestionData'
    : 'loadQuestionError';
}

export function useCourseBanks(course: Course) {
  const { t } = usePreferences();
  const [practiceSets, setPracticeSets] = useState<LoadedPractice[]>([]);
  const [mockBank, setMockBank] = useState<Question[]>([]);
  const [archivedBank, setArchivedBank] = useState<Question[]>([]);
  const [loadingError, setLoadingError] = useState<LoadError>();
  const [mockError, setMockError] = useState<LoadError>();

  useEffect(() => {
    let cancelled = false;
    const requests = new Map<string, Promise<Question[]>>();
    function load(path: string) {
      const cached = requests.get(path);
      if (cached) return cached;
      const request = loadQuestions(path);
      requests.set(path, request);
      return request;
    }

    Promise.all(
      course.practice.map(async ({ path, ...set }) => ({ ...set, questions: await load(path) })),
    )
      .then((sets) => {
        if (!cancelled) setPracticeSets(sets);
      })
      .catch((error) => {
        if (!cancelled) setLoadingError(errorKey(error));
      });
    Promise.all([load(course.mock), Promise.all(course.archives.map(load))])
      .then(([current, archived]) => {
        if (cancelled) return;
        setMockBank(current);
        setArchivedBank(archived.flat());
      })
      .catch((error) => {
        if (!cancelled) setMockError(errorKey(error));
      });
    return () => {
      cancelled = true;
    };
  }, [course]);

  const questions = practiceSets.flatMap((set) => set.questions);
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
  const randomBank = [
    ...new Map(questions.map((question) => [questionKey(question), question])).values(),
  ];
  return { questions, questionSets, randomBank, mockBank, archivedBank, loadingError, mockError };
}
