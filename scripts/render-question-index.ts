import { readFile, writeFile } from 'node:fs/promises';
import { certifications } from '../src/certifications.ts';
import { parseCheckpointQuestions } from '../src/fundamentals/checkpointQuestions.ts';
import { parseQuestions, questionKey } from '../src/questions.ts';

const entries = new Map<string, [string, string] | null>();
const banks = new Map<string, ReturnType<typeof parseQuestions>>();
async function include(certificationId: string, path: string) {
  let questions = banks.get(path);
  if (!questions) {
    questions = parseQuestions(JSON.parse(await readFile(`public/${path}`, 'utf8')));
    banks.set(path, questions);
  }
  for (const question of questions) {
    const key = questionKey(question);
    const existing = entries.get(key);
    if (existing === null || (existing && existing[0] !== certificationId)) entries.set(key, null);
    else if (!existing) entries.set(key, [certificationId, path]);
  }
}
function missing(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
async function includeIfPresent(certificationId: string, path: string) {
  try {
    await include(certificationId, path);
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

for (const certification of certifications) {
  const course = certification.course;
  if (!course) continue;
  for (const path of new Set([
    ...course.practice.map((set) => set.path),
    course.mock,
    ...course.archives,
  ])) {
    await include(certification.id, path);
  }
}
const fundamentals: unknown = JSON.parse(await readFile('public/fundamentals/content.json', 'utf8'));
if (
  !fundamentals ||
  typeof fundamentals !== 'object' ||
  !('units' in fundamentals) ||
  !Array.isArray(fundamentals.units)
) {
  throw new Error('Fundamentals question catalog is invalid');
}
for (const unit of fundamentals.units) {
  if (!unit || typeof unit !== 'object' || !('questions' in unit))
    throw new Error('Fundamentals unit is invalid');
  for (const question of parseQuestions(unit.questions))
    entries.set(questionKey(question), ['fundamentals', 'fundamentals/content.json']);
}
await includeIfPresent('fundamentals', 'fundamentals/archive/2026-11-questions.json');
const checkpoints = parseCheckpointQuestions(
  JSON.parse(await readFile('public/fundamentals/checkpoints.json', 'utf8')),
);
for (const question of checkpoints)
  entries.set(questionKey(question), ['fundamentals', 'fundamentals/checkpoints.json']);
await writeFile(
  'public/learning-question-index.v1.json',
  JSON.stringify({ schemaVersion: 1, questions: Object.fromEntries(entries) }),
);
console.log(`Indexed ${entries.size} published and archived question revisions`);
