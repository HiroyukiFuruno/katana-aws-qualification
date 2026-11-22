import overrides from './question-source-overrides.json';
import { questionKey, type Question } from './questions';

export function questionAdditionalSources(question: Pick<Question, 'id' | 'revision'>) {
  const sources: Record<string, { label: string; url: string }[]> = overrides;
  return sources[questionKey(question)] ?? [];
}
