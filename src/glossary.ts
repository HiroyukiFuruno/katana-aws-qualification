import terms from './glossary-terms.json' with { type: 'json' };

const alphabetic = new Intl.Collator('en', { sensitivity: 'base' });
export const glossary = terms
  .map(({ term, expansion, definition }) => [term, expansion, definition] as const)
  .sort(([left], [right]) => alphabetic.compare(left, right));
