import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import type { NaturalQuestionReview } from './natural-question-review';
import { mergeNaturalQuestion, naturalQuestionHash } from './natural-translation-content';
import { schemaFor, targetLocalesFor } from './natural-translation-schema';

export async function writeQuestionSchema(
  directory: string,
  questions: Question[],
  sourceLocale: string,
  reviewOnly: boolean,
) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'schema.json');
  const schema = schemaFor(
    sourceLocale,
    questions.length,
    !reviewOnly,
    questions.some((question) => Boolean(question.references?.length)),
  );
  await writeFile(path, JSON.stringify(schema));
  return path;
}

export type NaturalQuestionRecord = {
  locales: Record<string, Record<string, unknown>>;
  review?: NaturalQuestionReview;
  model: string;
  thread: string;
  usage: unknown;
  reviewModel?: string;
  reviewThread?: string;
  languageReviews?: {
    locales: Locale[];
    status: 'pass';
    reviewerThread: string;
    reviewerAgent?: string;
    evidence: string;
    edits: number;
  }[];
};

export async function readNaturalQuestion(question: Question, sourceLocale: string) {
  const hash = naturalQuestionHash(question, sourceLocale);
  const record: NaturalQuestionRecord = JSON.parse(
    await readFile(`output/question-quality/ai/natural/cache/${hash}.json`, 'utf8'),
  );
  if (!record.model || !record.thread) throw new Error('Missing natural translation provenance');
  for (const locale of targetLocalesFor(sourceLocale))
    mergeNaturalQuestion(question, record.locales[locale], locale);
  return record;
}
