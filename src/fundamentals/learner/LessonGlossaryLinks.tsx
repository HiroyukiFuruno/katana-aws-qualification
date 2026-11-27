import { termAnchor } from '../../glossaryAnchor';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import glossaryLinks from './lesson-glossary-links.json' with { type: 'json' };

const links = new Map(Object.entries(glossaryLinks));

export function LessonGlossaryLinks({ stepId }: { stepId: string }) {
  const { locale, t } = usePreferences();
  const terms = links.get(stepId);
  if (!terms) return null;
  return (
    <nav aria-label={t('glossary')} className="lesson-glossary-links">
      <ul>
        {terms.map((term) => (
          <li key={term} lang="en">
            <a
              href={`${localePath(locale, 'glossary')}#${termAnchor(term)}`}
              target="_blank"
              rel="noreferrer"
            >
              {term}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
