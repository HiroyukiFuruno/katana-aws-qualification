import { Fragment } from 'react';
import { glossary } from './glossary';
import localizedMentions from './glossary-mentions.json' with { type: 'json' };
import { termAnchor } from './glossaryAnchor';

const termNames = new Map(glossary.map(({ term }) => [term.toLowerCase(), term]));
for (const [mention, term] of Object.entries(localizedMentions)) {
  termNames.set(mention.toLowerCase(), term);
}
const mentions = [...termNames.keys()]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const mentionPattern = new RegExp(`(?<![a-z0-9-])(?:${mentions})(?![a-z0-9-])`, 'gi');

export function GlossaryDefinition({
  text,
  term,
  onFollow,
}: {
  text: string;
  term: string;
  onFollow: (term: string) => void;
}) {
  let cursor = 0;
  const links = [...text.matchAll(mentionPattern)].flatMap((match) => {
    const mention = match[0];
    const target = termNames.get(mention.toLowerCase());
    if (!target || target === term) return [];
    const before = text.slice(cursor, match.index);
    cursor = match.index + mention.length;
    return (
      <Fragment key={match.index}>
        {before}
        <a href={`#${termAnchor(target)}`} onClick={() => onFollow(target)}>
          {mention}
        </a>
      </Fragment>
    );
  });
  return (
    <>
      {links}
      {text.slice(cursor)}
    </>
  );
}
