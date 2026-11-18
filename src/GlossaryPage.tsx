import { glossary } from './glossary';
import { usePreferences } from './preferences';

export function GlossaryPage() {
  const { t } = usePreferences();
  return (
    <main id="main" className="shell">
      <div className="intro">
        <h1>{t('glossary')}</h1>
        <p>{t('glossaryIntro')}</p>
      </div>
      <dl className="card glossary" lang="ja">
        {glossary.map(([term, expansion, definition]) => (
          <div key={term}>
            <dt lang="en">
              <strong>{term}</strong>
              {expansion && <span>{expansion}</span>}
            </dt>
            <dd>{definition}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
