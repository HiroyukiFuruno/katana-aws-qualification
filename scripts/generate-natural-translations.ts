import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeQuestionSchema } from './natural-question-cache';
import { writeNaturalQuestionRecord } from './natural-question-cache-write';
import { naturalQuestionInput } from './natural-question-input';
import { naturalQuestionQueue } from './natural-question-queue';
import { inspectNaturalQuestionResults } from './natural-question-results';
import { runNaturalTranslationAgent } from './natural-translation-agent';
import { targetLocalesFor } from './natural-translation-schema';
import { contentJobs } from './translation-data';

const root = 'output/question-quality/ai/natural';
await mkdir(join(root, 'cache'), { recursive: true });
const controlPath = join(root, 'worker-count.json');
try {
  await readFile(controlPath, 'utf8');
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  await writeFile(controlPath, '{"workers":1}\n');
}
const limit = Number(process.env.NATURAL_TRANSLATION_BATCH_LIMIT ?? Infinity);
const batchSize = Math.max(1, Math.min(8, Number(process.env.NATURAL_TRANSLATION_BATCH_SIZE ?? 4)));
const queue = await naturalQuestionQueue(await contentJobs(), batchSize, limit);
const { batches, existing, total } = queue;
let completed = queue.completed;
console.log(`Natural translation: ${completed}/${total} questions cached; ${batches.length} batches`);
let stopping = false;
const batchFailures: unknown[] = [];
process.on('SIGINT', () => {
  stopping = true;
});
const outcomes = await Promise.allSettled(
  Array.from({ length: Math.min(3, batches.length) }, async (_, worker) => {
    while (batches.length) {
      if (stopping) return;
      while (worker > 0 && batches.length) {
        const control: { workers: number } = JSON.parse(await readFile(controlPath, 'utf8'));
        if (stopping) return;
        if (control.workers > worker) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const batch = batches.shift();
      if (!batch) return;
      const sourceLocale = batch[0].sourceLocale;
      const targetLocales = targetLocalesFor(sourceLocale);
      const reviewOnly = existing.has(batch[0].hash);
      let remaining = batch;
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        const directory = join(
          root,
          'batches',
          `${remaining[0].hash}-${remaining.length}-${Date.now()}-${attempt}`,
        );
        let generated: Awaited<ReturnType<typeof runNaturalTranslationAgent>>;
        let inspected: ReturnType<typeof inspectNaturalQuestionResults>;
        try {
          const schemaPath = await writeQuestionSchema(
            directory,
            remaining.map(({ question }) => question),
            sourceLocale,
            reviewOnly,
          );
          generated = await runNaturalTranslationAgent(
            naturalQuestionInput(
              remaining.map(({ question }) => question),
              sourceLocale,
              targetLocales,
              reviewOnly,
              lastError ? String(lastError) : undefined,
            ),
            directory,
            schemaPath,
            attempt,
          );
          inspected = inspectNaturalQuestionResults(
            remaining.map(({ question }) => question),
            generated.result,
            targetLocales,
            reviewOnly,
          );
        } catch (error) {
          lastError = error;
          await writeFile(join(directory, 'validation-error.txt'), String(error));
          console.log(`worker ${worker}: batch validation failed, attempt ${attempt + 1}; ${directory}`);
          continue;
        }
        for (const result of inspected.valid) {
          const { hash, question } = remaining[result.index];
          const cached = existing.get(hash);
          const record = {
            ...cached,
            sourceHash: hash,
            sourceLocale,
            id: question.id,
            revision: question.revision,
            locales: cached?.locales ?? result.locales,
            review: result.review,
            model: cached?.model ?? generated.model,
            thread: cached?.thread ?? generated.thread,
            usage: cached?.usage ?? generated.usage,
            reviewModel: generated.model,
            reviewThread: generated.thread,
          };
          await writeNaturalQuestionRecord(join(root, 'cache'), hash, record);
          completed++;
        }
        if (inspected.valid.length)
          console.log(
            `worker ${worker}: ${completed}/${total} questions naturally translated in 9 locales`,
          );
        if (!inspected.failed.length) {
          lastError = undefined;
          break;
        }
        lastError = new Error(inspected.failed.map(({ error }) => error).join('\n'));
        remaining = inspected.failed.map(({ index }) => remaining[index]);
        await writeFile(join(directory, 'validation-error.txt'), String(lastError));
        console.log(
          `worker ${worker}: ${remaining.length} questions pending retry, attempt ${attempt + 1}; ${directory}`,
        );
      }
      if (lastError) {
        await mkdir(join(root, 'pending'), { recursive: true });
        await writeFile(
          join(root, 'pending', `${batch[0].hash}-${Date.now()}.json`),
          `${JSON.stringify({ observedAt: new Date().toISOString(), attempts: 3, error: String(lastError), questions: remaining.map(({ hash, question }) => ({ hash, id: question.id, revision: question.revision, sourceLocale })) }, null, 2)}\n`,
        );
        batchFailures.push(lastError);
      }
    }
  }).map((worker) =>
    worker.catch((error: unknown) => {
      // 保存先などの予期しない障害では、新しいAI処理を増やさず実行中の結果を回収する。
      stopping = true;
      throw error;
    }),
  ),
);
const failures = [
  ...batchFailures,
  ...outcomes.flatMap((outcome) => (outcome.status === 'rejected' ? [outcome.reason] : [])),
];
if (failures.length) throw new AggregateError(failures, 'Natural translation workers failed');
