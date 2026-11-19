import type { Question } from './questions';

export function QuestionSources({ question }: { question: Question }) {
  const sources = [question.source, ...(question.references ?? [])];
  const links = sources.map((source) => (
    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
      {source.label} ↗
    </a>
  ));
  return sources.length === 1 ? (
    links[0]
  ) : (
    <ul>
      {links.map((link) => (
        <li key={link.key}>{link}</li>
      ))}
    </ul>
  );
}
