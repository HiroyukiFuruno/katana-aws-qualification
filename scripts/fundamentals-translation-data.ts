import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type NarrativeJson =
  | string
  | number
  | boolean
  | null
  | NarrativeJson[]
  | { [key: string]: NarrativeJson };
export type NarrativeUnit = {
  path: string[];
  hash: string;
  context: NarrativeJson;
  fields: { path: string[]; text: string }[];
};
const visibleKeys = new Set([
  'title',
  'objective',
  'summary',
  'explanation',
  'example',
  'text',
  'prompt',
  'reason',
  'concept',
  'answer',
  'label',
  'paragraphs',
  'takeaways',
  'scenario',
  'steps',
  'outcome',
  'claim',
  'correction',
]);
export const narrativeHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fieldsIn(value: NarrativeJson, path: string[] = [], key = ''): NarrativeUnit['fields'] {
  if (typeof value === 'string') return visibleKeys.has(key) ? [{ path, text: value }] : [];
  if (Array.isArray(value))
    return value.flatMap((item, index) => fieldsIn(item, [...path, String(index)], key));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([name, item]) => fieldsIn(item, [...path, name], name));
  return [];
}

export function narrativeUnits(value: NarrativeJson, path: string[] = []): NarrativeUnit[] {
  if (Array.isArray(value))
    return value.flatMap((item, index) => narrativeUnits(item, [...path, String(index)]));
  if (!value || typeof value !== 'object') return [];
  if ('prompt' in value || 'paragraphs' in value || 'blocks' in value) {
    const fields = fieldsIn(value);
    return fields.length
      ? [{ path, hash: narrativeHash({ context: value, fields }), context: value, fields }]
      : [];
  }
  const direct = Object.fromEntries(
    Object.entries(value).filter(
      ([name, item]) =>
        visibleKeys.has(name) &&
        (typeof item === 'string' ||
          (Array.isArray(item) && item.every((entry) => typeof entry === 'string'))),
    ),
  );
  const fields = fieldsIn(direct);
  const context = Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item !== 'object' || item === null),
  );
  const result: NarrativeUnit[] = fields.length
    ? [{ path, hash: narrativeHash({ context, fields }), context, fields }]
    : [];
  for (const [name, item] of Object.entries(value))
    if (!(name in direct)) result.push(...narrativeUnits(item, [...path, name]));
  return result;
}

export function applyNarrativeUnit(root: NarrativeJson, unit: NarrativeUnit, texts: string[]) {
  if (texts.length !== unit.fields.length) throw new Error('Narrative translation field count changed');
  for (const [index, field] of unit.fields.entries()) {
    const path = [...unit.path, ...field.path];
    let cursor = root;
    for (const segment of path.slice(0, -1)) {
      if (!cursor || typeof cursor !== 'object') throw new Error('Narrative translation path changed');
      cursor = (cursor as Record<string, NarrativeJson>)[segment];
    }
    (cursor as Record<string, NarrativeJson>)[path.at(-1) as string] = texts[index];
  }
}

export async function fundamentalsTranslationJobs(
  directory = 'public/fundamentals',
): Promise<{ path: string; data: NarrativeJson }[]> {
  const jobs: { path: string; data: NarrativeJson }[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) jobs.push(...(await fundamentalsTranslationJobs(filename)));
    else if (
      entry.name.endsWith('.json') &&
      !['routeManifest.json', 'trustedCatalog.json'].includes(entry.name)
    ) {
      jobs.push({
        path: filename.slice('public/'.length),
        data: JSON.parse(await readFile(filename, 'utf8')),
      });
    }
  }
  return jobs;
}
