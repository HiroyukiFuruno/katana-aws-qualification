import { glossaryCategories, glossaryTags } from './glossary';
import { usePreferences } from './preferences';

export function GlossaryFilters({
  query,
  category,
  tags,
  setQuery,
  setCategory,
  toggleTag,
  reset,
  count,
  total,
}: {
  query: string;
  category: string;
  tags: string[];
  setQuery: (query: string) => void;
  setCategory: (category: string) => void;
  toggleTag: (tag: string) => void;
  reset: () => void;
  count: number;
  total: number;
}) {
  const { t } = usePreferences();
  return (
    <search className="glossary-filters">
      <div className="glossary-controls">
        <label className="glossary-search" htmlFor="glossary-search">
          {t('glossarySearch')}
          <input
            type="search"
            id="glossary-search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <div className="glossary-category">
          <label htmlFor="glossary-category">{t('glossaryCategory')}</label>
          <select
            id="glossary-category"
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value)}
          >
            <option value="">{t('glossaryAllCategories')}</option>
            {Object.entries(glossaryCategories).map(([id, label]) => (
              <option key={id} value={id}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="glossary-tag-filters" aria-describedby="glossary-tag-hint">
        <legend>{t('glossaryTags')}</legend>
        <p id="glossary-tag-hint">{t('glossaryTagHint')}</p>
        <div className="glossary-chips">
          {Object.entries(glossaryTags).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={tags.includes(id)}
              onClick={() => toggleTag(id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="glossary-summary">
        <p role="status">{t('glossaryCount', { count, total })}</p>
        <button type="button" onClick={reset} disabled={!query && !category && tags.length === 0}>
          {t('glossaryReset')}
        </button>
      </div>
    </search>
  );
}
