import type { Certification } from '../src/certificationTypes.ts';
import { type Question, questionGroupKey } from '../src/questions.ts';

type QuestionIdentity = Pick<Question, 'id' | 'similarityGroup'>;

export function catalogStats(
  catalog: readonly Pick<Certification, 'course'>[],
  readBank: (path: string) => readonly QuestionIdentity[],
) {
  let certifications = 0;
  let questions = 0;
  for (const { course } of catalog) {
    if (!course) continue;
    const paths = [...new Set([course.mock, ...course.practice.map(({ path }) => path)])];
    const activeQuestions = new Set(paths.flatMap((path) => readBank(path).map(questionGroupKey)));
    certifications += 1;
    questions += activeQuestions.size;
  }
  return { certifications, questions };
}
