import { writeFile } from 'node:fs/promises';
import { sourceLocaleOf } from '../src/questionSourceLocale';
import type { Question } from '../src/questions';
import { fundamentalsNarrativeJobs } from './fundamentals-narrative-jobs';
import { lessonQuestion, readLessonReview } from './natural-lesson-review';
import { readNarrative } from './natural-narrative-translation';
import { readNaturalQuestion } from './natural-question-cache';
import { validateNaturalReview } from './natural-question-review';
import { naturalQuestionHash } from './natural-translation-content';
import { contentJobs } from './translation-data';

const questions = [];
let translated = 0;
let reviewed = 0;
let issues = 0;
for (const { path, data } of (await contentJobs()).filter((job) => job.path !== 'site.json')) {
  for (const question of data as Question[]) {
    const sourceLocale = sourceLocaleOf(path);
    const identity = {
      path,
      id: question.id,
      revision: question.revision,
      sourceHash: naturalQuestionHash(question, sourceLocale),
    };
    try {
      const record = await readNaturalQuestion(question, sourceLocale);
      translated++;
      try {
        validateNaturalReview(question, record.review);
        if (record.review.status === 'pass') reviewed++;
        else issues++;
        questions.push({
          ...identity,
          status: record.review.status,
          review: record.review,
          model: record.reviewModel ?? record.model,
          thread: record.reviewThread ?? record.thread,
        });
      } catch {
        questions.push({ ...identity, status: 'pending-review' });
      }
    } catch {
      questions.push({ ...identity, status: 'pending-translation' });
    }
  }
}
const lessonUnits = new Map(
  (await fundamentalsNarrativeJobs())
    .flatMap(({ units }) => units)
    .map(({ source }) => [source.hash, source]),
);
let lessons = 0;
const lessonReviews = [];
for (const unit of lessonUnits.values()) {
  try {
    await readNarrative(unit);
    lessons++;
  } catch {
    /* 欠損は未完了の母数に残す。 */
  }
  const question = lessonQuestion(unit);
  if (question) {
    try {
      const record = await readLessonReview(unit);
      lessonReviews.push({ hash: unit.hash, id: question.id, status: record?.review.status, ...record });
    } catch {
      lessonReviews.push({ hash: unit.hash, id: question.id, status: 'pending' });
    }
  }
}
const report = {
  observedAt: new Date().toISOString(),
  canonicalQuestions: questions.length,
  naturallyTranslatedQuestions: translated,
  semanticReviewsPassed: reviewed,
  semanticReviewsNeedingAction: issues,
  lessonNarratives: { total: lessonUnits.size, translated: lessons },
  lessonQuestionReviews: {
    total: lessonReviews.length,
    passed: lessonReviews.filter((record) => record.status === 'pass').length,
    needsAction: lessonReviews.filter((record) => record.status === 'needs-review').length,
  },
};
await writeFile('output/question-quality/progress.json', `${JSON.stringify(report, null, 2)}\n`);
await writeFile(
  'docs/reviews/20261121-ai-question-review.json',
  `${JSON.stringify({ ...report, questions }, null, 2)}\n`,
);
await writeFile(
  'docs/reviews/20261121-fundamentals-semantic-review.json',
  `${JSON.stringify({ observedAt: report.observedAt, questions: lessonReviews }, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
