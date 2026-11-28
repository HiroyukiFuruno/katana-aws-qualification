import { termAnchor } from '../glossaryAnchor';
import { type Locale, localePath } from '../locales.ts';
import { AppliedCaseArticle } from './AppliedCaseArticle';
import { appliedContentFor, appliedResourcesFor } from './cases.ts';
import { appliedCaseForPage, appliedCases, appliedDirectory, appliedIndexPage } from './routes.ts';

export default function AppliedPages({ page, locale }: { page: string; locale: Locale }) {
  const directory = appliedDirectory(locale);
  if (page === appliedIndexPage) {
    return (
      <main id="main" className="shell applied-case">
        <h1>{directory.title}</h1>
        <p>{directory.description}</p>
        <div className="entry-grid study-paths">
          {appliedCases(locale).map((entry) => (
            <a className="entry-card" key={entry.id} href={localePath(locale, entry.page)}>
              <h2>{entry.title}</h2>
              <p>{entry.description}</p>
            </a>
          ))}
        </div>
      </main>
    );
  }
  const entry = appliedCaseForPage(locale, page);
  if (!entry) throw new Error(`Unknown applied page: ${page}`);
  const lesson = appliedContentFor(locale, entry.id);
  return (
    <AppliedCaseArticle
      lesson={lesson}
      locale={locale}
      back={{ href: localePath(locale, appliedIndexPage), label: directory.title }}
      foundations={entry.prerequisites.map(({ slug, title }) => ({
        href: localePath(locale, `study/fundamentals/${slug}`),
        label: title,
      }))}
      glossary={appliedResourcesFor(entry.id).glossaryTerms.map((term) => ({
        href: `${localePath(locale, 'glossary')}#${termAnchor(term)}`,
        label: term,
      }))}
    />
  );
}
