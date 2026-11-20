import { parseCheckpointQuestions } from '../fundamentals/checkpointQuestions';
import { validFundamentalsContent } from '../fundamentals/content';
import { parseQuestions, type Question, questionKey } from '../questions';

type IndexEntry = [string, string] | null;
type QuestionIndex = { schemaVersion: 1; questions: Record<string, IndexEntry> };
type Fetcher = (input: RequestInfo | URL) => Promise<Response>;

function parseIndex(value: unknown): QuestionIndex {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('questions' in value)
  )
    throw new Error('Question index is invalid');
  const questions = value.questions;
  if (!questions || typeof questions !== 'object' || Array.isArray(questions))
    throw new Error('Question index is invalid');
  for (const entry of Object.values(questions)) {
    if (entry === null) continue;
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      entry.some((part) => typeof part !== 'string') ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry[0]) ||
      !/^(courses\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.json|fundamentals\/(?:content|checkpoints|archive\/[0-9]{4}-[0-9]{2}-questions)\.json)$/.test(
        entry[1],
      )
    )
      throw new Error('Question index entry is invalid');
  }
  return value as QuestionIndex;
}

export function createQuestionResolver(fetcher: Fetcher = fetch) {
  let index: Promise<QuestionIndex> | undefined;
  const banks = new Map<string, Promise<Question[]>>();
  async function json(path: string): Promise<unknown> {
    const response = await fetcher(`/${path}`);
    if (!response.ok) throw new Error('Question catalog could not be loaded');
    return response.json();
  }
  function loadIndex() {
    if (index) return index;
    const pending = json('learning-question-index.v1.json').then(parseIndex);
    index = pending;
    void pending.catch(() => {
      if (index === pending) index = undefined;
    });
    return pending;
  }
  function loadBank(path: string) {
    const existing = banks.get(path);
    if (existing) return existing;
    const pending = json(path).then((value) => {
      if (path === 'fundamentals/checkpoints.json') return parseCheckpointQuestions(value);
      if (path === 'fundamentals/content.json') {
        if (!validFundamentalsContent(value)) throw new Error('Fundamentals catalog is invalid');
        return value.units.flatMap((unit) => unit.questions);
      }
      return parseQuestions(value);
    });
    banks.set(path, pending);
    void pending.catch(() => {
      if (banks.get(path) === pending) banks.delete(path);
    });
    return pending;
  }
  return async (questionId: string, revision: number) => {
    const key = questionKey({ id: questionId, revision });
    const entry = (await loadIndex()).questions[key];
    if (!entry) return undefined;
    const [certificationId, path] = entry;
    const question = (await loadBank(path)).find((candidate) => questionKey(candidate) === key);
    return question ? { certificationId, question } : undefined;
  };
}
