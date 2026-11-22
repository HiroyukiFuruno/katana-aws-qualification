import { parseCheckpointQuestions } from '../fundamentals/checkpointQuestions';
import { validFundamentalsContent } from '../fundamentals/content';
import { overlayFundamentalsContent } from '../fundamentals/contentLocalization';
import type { Locale } from '../locales';
import { loadQuestionBank } from '../questionLocalization';
import { sourceLocaleOf } from '../questionSourceLocale';
import { parseQuestions, type Question, questionKey } from '../questions';

type IndexEntry = [string, string] | null;
type QuestionIndex = { schemaVersion: 1; questions: Record<string, IndexEntry> };
type Fetcher = (input: RequestInfo | URL) => Promise<Response>;

function questionIdentity(question: Question) {
  return {
    ...question,
    title: undefined,
    prompt: undefined,
    source: { url: question.source.url },
    references: question.references?.map((reference) => ({ url: reference.url })),
    choices: question.choices.map(({ explanation, text, ...choice }) => choice),
    learning: question.learning ? { check: question.learning.check ? {} : undefined } : undefined,
  };
}

function overlayNarrativeQuestions(canonical: Question[], translated: unknown) {
  const localized = parseQuestions(translated);
  if (
    canonical.length !== localized.length ||
    canonical.some(
      (question, index) =>
        JSON.stringify(questionIdentity(question)) !==
        JSON.stringify(questionIdentity(localized[index])),
    )
  ) {
    throw new Error('Localized question identity changed.');
  }
  return canonical.map((question, index) => {
    const localizedQuestion = localized[index];
    return {
      ...question,
      title: localizedQuestion.title,
      prompt: localizedQuestion.prompt,
      source: { ...question.source, label: localizedQuestion.source.label },
      references: question.references?.map((reference, referenceIndex) => ({
        ...reference,
        label: localizedQuestion.references?.[referenceIndex]?.label ?? reference.label,
      })),
      choices: question.choices.map((choice, choiceIndex) => ({
        ...choice,
        ...localizedQuestion.choices[choiceIndex],
      })),
      learning: localizedQuestion.learning,
    };
  });
}

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

export function createQuestionResolver(fetcher: Fetcher = fetch, locale?: Locale) {
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
  function parseBank(path: string, value: unknown) {
    if (path === 'fundamentals/checkpoints.json') return parseCheckpointQuestions(value);
    if (path === 'fundamentals/content.json') {
      if (!validFundamentalsContent(value)) throw new Error('Fundamentals catalog is invalid');
      return value.units.flatMap((unit) => unit.questions);
    }
    return parseQuestions(value);
  }
  async function localizeBank(path: string, base: unknown, canonical: Question[]) {
    if (!locale || locale === sourceLocaleOf(path)) return canonical;
    const translation = await json(`translations/${locale}/${path}`);
    if (path === 'fundamentals/content.json') {
      if (!validFundamentalsContent(base) || !validFundamentalsContent(translation))
        throw new Error('Fundamentals catalog is invalid');
      return overlayFundamentalsContent(base, translation).units.flatMap((unit) => unit.questions);
    }
    return overlayNarrativeQuestions(canonical, translation);
  }
  function loadBank(path: string) {
    const existing = banks.get(path);
    if (existing) return existing;
    const pending =
      locale && path.startsWith('courses/')
        ? loadQuestionBank(path, locale, fetcher).then((bank) => bank.questions)
        : json(path).then(async (value) => localizeBank(path, value, parseBank(path, value)));
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

export function createLocalizedQuestionResolver(locale: Locale, fetcher: Fetcher = fetch) {
  return createQuestionResolver(fetcher, locale);
}
