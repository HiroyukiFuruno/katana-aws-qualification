import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  fundamentalsTranslationJobs,
  narrativeUnits,
  type NarrativeUnit,
} from './fundamentals-translation-data';
import { validateNaturalReview, type NaturalQuestionReview } from './natural-question-review';
import { runNaturalTranslationAgent } from './natural-translation-agent';
import { schemaFor } from './natural-translation-schema';

const root = 'output/question-quality/ai/lesson-review';
type LessonReviewRecord = { review: NaturalQuestionReview; model: string; thread: string };
export function lessonQuestion(unit: NarrativeUnit) {
  const value = unit.context;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('prompt' in value)) return;
  assert(typeof value.id === 'string', 'Lesson question has no canonical ID');
  return { ...value, id: value.id };
}

export async function readLessonReview(unit: NarrativeUnit) {
  const question = lessonQuestion(unit);
  if (!question) return;
  const record: LessonReviewRecord = JSON.parse(
    await readFile(join(root, 'cache', `${unit.hash}.json`), 'utf8'),
  );
  validateNaturalReview(question, record.review);
  assert(record.model && record.thread, 'Missing lesson semantic review provenance');
  return record;
}

async function generateLessonReviews() {
  await mkdir(join(root, 'cache'), { recursive: true });
  const unique = new Map(
    (await fundamentalsTranslationJobs())
      .flatMap((job) => narrativeUnits(job.data))
      .filter(lessonQuestion)
      .map((unit) => [unit.hash, unit]),
  );
  const pending: NarrativeUnit[] = [];
  for (const unit of unique.values()) {
    try {
      await readLessonReview(unit);
    } catch {
      pending.push(unit);
    }
  }
  const batchSize = 12;
  let completed = unique.size - pending.length;
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    let failure: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const directory = join(root, 'batches', `${batch[0].hash}-${Date.now()}-${attempt}`);
      await mkdir(directory, { recursive: true });
      const schemaPath = join(directory, 'schema.json');
      await writeFile(schemaPath, JSON.stringify(schemaFor('ja', batch.length, false)));
      try {
        const result = await runNaturalTranslationAgent(
          { sourceLocale: 'ja', targetLocales: [], questions: batch.map((unit) => unit.context) },
          directory,
          schemaPath,
          attempt,
        );
        assert(
          Array.isArray(result.result.reviews) && result.result.reviews.length === batch.length,
          'Incomplete lesson review batch',
        );
        for (const [index, unit] of batch.entries()) {
          const question = lessonQuestion(unit);
          assert(question);
          const review = result.result.reviews[index];
          validateNaturalReview(question, review);
          await writeFile(
            join(root, 'cache', `${unit.hash}.json`),
            `${JSON.stringify({ review, model: result.model, thread: result.thread }, null, 2)}\n`,
          );
        }
        completed += batch.length;
        console.log(`Lesson question semantic reviews ${completed}/${unique.size}`);
        failure = undefined;
        break;
      } catch (error) {
        failure = error;
        await writeFile(join(directory, 'validation-error.txt'), String(error));
      }
    }
    if (failure) throw failure;
  }
}
if (import.meta.main) await generateLessonReviews();
