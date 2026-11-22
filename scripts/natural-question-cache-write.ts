import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NaturalQuestionRecord } from './natural-question-cache';

export async function writeNaturalQuestionRecord(
  directory: string,
  hash: string,
  record: NaturalQuestionRecord,
) {
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `${hash}.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`);
  await rename(temporary, join(directory, `${hash}.json`));
}
