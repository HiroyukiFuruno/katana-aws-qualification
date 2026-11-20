import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { filterGlossary, glossary, glossaryCategories, glossaryTags } from './glossary';
import { GlossaryDefinition, termAnchor } from './GlossaryDefinition';
import { GlossaryFilters } from './GlossaryFilters';
import './glossary.css';
import { usePreferences } from './preferences';
import { SiteAd } from './SiteAd';

export function GlossaryPage() {
  const { t, locale } = usePreferences();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const matches = filterGlossary(query, category, tags);
  const groups = new Map<string, typeof matches>();
  for (const entry of matches) {
    const initial = entry.term[0].toUpperCase();
    const group = groups.get(initial) ?? [];
    group.push(entry);
    groups.set(initial, group);
  }

  useEffect(() => {
    const anchor = location.hash.slice(1);
    if (anchor.startsWith('glossary-')) document.getElementById(anchor)?.scrollIntoView();
  }, []);

  function reset() {
    setQuery('');
    setCategory('');
    setTags([]);
  }

  function followTerm(term: string) {
    if (!matches.some((entry) => entry.term === term)) flushSync(reset);
  }

  function toggleTag(tag: string) {
    setTags((previous) =>
      previous.includes(tag) ? previous.filter((id) => id !== tag) : [...previous, tag],
    );
  }

  return (
    <main id="main" className="shell glossary-page">
      <div className="intro">
        <h1>{t('glossary')}</h1>
        <p>{t('glossaryIntro')}</p>
      </div>
      <SiteAd placement="inline" />
      <GlossaryFilters
        query={query}
        category={category}
        tags={tags}
        setQuery={setQuery}
        setCategory={setCategory}
        toggleTag={toggleTag}
        reset={reset}
        count={matches.length}
        total={glossary.length}
      />
      {groups.size > 0 ? (
        <nav aria-label="A–Z" className="glossary-index">
          {[...groups.keys()].map((letter) => (
            <a key={letter} href={`#glossary-letter-${letter}`}>
              {letter}
            </a>
          ))}
        </nav>
      ) : (
        <p>{t('glossaryNoResults')}</p>
      )}
      <div className="glossary-groups">
        {[...groups].map(([letter, entries]) => (
          <section key={letter} aria-labelledby={`glossary-letter-${letter}`}>
            <h2 id={`glossary-letter-${letter}`}>{letter}</h2>
            <dl lang="ja">
              {entries.map(
                ({ term, expansion, definition, category: termCategory, tags: termTags, source }) => (
                  <div key={term} className="glossary-row">
                    <dt id={termAnchor(term)} lang="en">
                      <strong>{term}</strong>
                      {expansion && <span>{expansion}</span>}
                    </dt>
                    <dd>
                      <GlossaryDefinition text={definition} term={term} onFollow={followTerm} />
                      <div className="glossary-chips glossary-term-tags" lang={locale}>
                        <button
                          type="button"
                          aria-pressed={category === termCategory}
                          onClick={() => setCategory(category === termCategory ? '' : termCategory)}
                        >
                          {t(glossaryCategories[termCategory])}
                        </button>
                        {termTags.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            aria-pressed={tags.includes(tag)}
                            onClick={() => toggleTag(tag)}
                          >
                            {t(glossaryTags[tag])}
                          </button>
                        ))}
                        {source && <a href={source}>{t('glossarySource')}</a>}
                      </div>
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
