import type { NarrativeUnit } from './fundamentals-translation-data';

export function narrativeFieldKeys(unit: NarrativeUnit) {
  const source = new Map<string, { paths: string[][]; text: string }>();
  const repeatedLabels = new Map<string, string>();
  const order = unit.fields.map((field, index) => {
    const isLabel = field.path.at(-1) === 'label';
    const existing = isLabel ? repeatedLabels.get(field.text) : undefined;
    if (existing) {
      source.get(existing)?.paths.push(field.path);
      return existing;
    }
    const key = `field${index}`;
    source.set(key, { paths: [field.path], text: field.text });
    if (isLabel) repeatedLabels.set(field.text, key);
    return key;
  });
  return { order, source: Object.fromEntries(source) };
}
