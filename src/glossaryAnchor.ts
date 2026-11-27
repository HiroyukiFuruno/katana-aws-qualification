export function termAnchor(term: string) {
  return `glossary-term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
