import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const courseIds = ['saa-c03', 'sap-c02', 'sap-c03', 'dva-c02', 'dva-c03', 'soa-c03', 'dea-c01'];
const delegatedCourseIds = new Set(['dva-c02', 'dva-c03', 'soa-c03']);
const courseRoot = 'public/courses';
const reviewPath = 'docs/reviews/20261121-core-questions.json';
const progressPath = 'docs/reviews/20261121-core-question-review-progress.json';

type Question = {
  id: string;
  revision: number;
  choices: { id: string; text: string }[];
  correct: string[];
  source: { url: string };
};

type Review = {
  path: string;
  id: string;
  revision: number;
  result: 'passed' | 'pending' | 'delegated';
  reason: string;
  sourceUrl: string;
};

type Progress = Record<string, string>;

const keyOf = (path: string, id: string) => `${path}:${id}`;
const readJson = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
};

const previous = await readJson<Review[]>(reviewPath, []);
const previousByKey = new Map(previous.map((review) => [keyOf(review.path, review.id), review]));
const progress = await readJson<Progress>(progressPath, {});
const records: Review[] = [];

for (const courseId of courseIds) {
  const directory = join(courseRoot, courseId);
  for (const file of (await readdir(directory)).filter((entry) => entry.endsWith('.json')).sort()) {
    const path = join(directory, file);
    const questions = JSON.parse(await readFile(path, 'utf8')) as Question[];
    for (const question of questions) {
      const key = keyOf(path, question.id);
      const delegated = delegatedCourseIds.has(courseId);
      const correct = question.correct.map(
        (id) => question.choices.find((choice) => choice.id === id)?.text ?? id,
      );
      const carried = previousByKey.get(key);
      const reason =
        progress[key] ??
        (carried?.revision === question.revision && carried.result === 'passed'
          ? carried.reason
          : undefined);
      records.push({
        path,
        id: question.id,
        revision: question.revision,
        result: delegated ? 'delegated' : reason ? 'passed' : 'pending',
        reason: delegated
          ? 'DVA/SOA担当へ委譲。詳細台帳: docs/reviews/20261121-development-operations-questions.json。'
          : (reason ??
            `未レビュー。正答候補: ${question.correct.join(', ')} (${correct.join(' / ')})。`),
        sourceUrl: question.source.url,
      });
    }
  }
}

await mkdir('docs/reviews', { recursive: true });
await writeFile(reviewPath, `${JSON.stringify(records, null, 2)}\n`);
console.log(
  `Wrote ${records.length} records (${records.filter((record) => record.result === 'passed').length} passed) to ${reviewPath}`,
);
