import { Fragment, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { glossary } from './glossary';
import { usePreferences } from './preferences';

function termAnchor(term: string) {
  return `glossary-term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const termNames = new Map(glossary.map(([term]) => [term.toLowerCase(), term]));
for (const [mention, term] of [
  ['パイロットライト', 'Pilot light'],
  ['ウォームスタンバイ', 'Warm standby'],
  ['VPCエンドポイント', 'VPC endpoint'],
  ['冪等性', 'Idempotency'],
]) {
  termNames.set(mention.toLowerCase(), term);
}

const mentions = [...termNames.keys()]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const mentionPattern = new RegExp(`(?<![a-z0-9-])(?:${mentions})(?![a-z0-9-])`, 'gi');

function Definition({
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

function searchText(value: string) {
  return value.normalize('NFKC').toLowerCase();
}

export function GlossaryPage() {
  const { t } = usePreferences();
  const [query, setQuery] = useState('');
  const search = searchText(query.trim());
  const words = search.split(/\s+/);
  const exact = glossary.find(([term]) => searchText(term) === search);
  const matches = exact
    ? [exact]
    : glossary.filter((entry) => {
        const text = searchText(entry.join(' '));
        return words.every((word) => text.includes(word));
      });
  const groups = new Map<string, typeof matches>();
  for (const entry of matches) {
    const initial = entry[0][0].toUpperCase();
    const group = groups.get(initial) ?? [];
    group.push(entry);
    groups.set(initial, group);
  }

  useEffect(() => {
    const anchor = location.hash.slice(1);
    if (anchor.startsWith('glossary-')) document.getElementById(anchor)?.scrollIntoView();
  }, []);

  function followTerm(term: string) {
    if (!matches.some(([name]) => name === term)) flushSync(() => setQuery(''));
  }

  return (
    <main id="main" className="shell glossary-page">
      <div className="intro">
        <h1>{t('glossary')}</h1>
        <p>{t('glossaryIntro')}</p>
      </div>
      <search className="glossary-search">
        <label htmlFor="glossary-search">{t('glossarySearch')}</label>
        <input
          type="search"
          id="glossary-search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </search>
      {groups.size > 0 ? (
        <nav aria-label="A–Z" className="glossary-index">
          {[...groups.keys()].map((letter) => (
            <a key={letter} href={`#glossary-letter-${letter}`}>
              {letter}
            </a>
          ))}
        </nav>
      ) : (
        <p role="status">{t('glossaryNoResults')}</p>
      )}
      <div className="glossary-groups">
        {[...groups].map(([letter, entries]) => (
          <section key={letter} aria-labelledby={`glossary-letter-${letter}`}>
            <h2 id={`glossary-letter-${letter}`}>{letter}</h2>
            <dl lang="ja">
              {entries.map(([term, expansion, definition]) => (
                <div key={term} className="glossary-row">
                  <dt id={termAnchor(term)} lang="en">
                    <strong>{term}</strong>
                    {expansion && <span>{expansion}</span>}
                  </dt>
                  <dd>
                    <Definition text={definition} term={term} onFollow={followTerm} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
