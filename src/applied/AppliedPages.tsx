import { termAnchor } from '../glossaryAnchor';
import { type Locale, localePath } from '../locales.ts';
import { AppliedCaseArticle, type AppliedCaseContent } from './AppliedCaseArticle';
import caseContent from './content.json' with { type: 'json' };
import figures from './figures.json' with { type: 'json' };
import resources from './resources.json' with { type: 'json' };
import { appliedCases, appliedDirectory, appliedIndexPage, ordersCaseId } from './routes.ts';

const ordersContent = caseContent as Record<Locale, AppliedCaseContent>;

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
  if (page !== `${appliedIndexPage}/${ordersCaseId}`) throw new Error(`Unknown applied page: ${page}`);
  return (
    <AppliedCaseArticle
      lesson={ordersContent[locale]}
      figures={figures}
      back={{ href: localePath(locale, appliedIndexPage), label: directory.title }}
      foundations={appliedCases(locale)[0].prerequisites.map(({ slug, title }) => ({
        href: localePath(locale, `study/fundamentals/${slug}`),
        label: title,
      }))}
      glossary={resources[ordersCaseId].glossaryTerms.map((term) => ({
        href: `${localePath(locale, 'glossary')}#${termAnchor(term)}`,
        label: term,
      }))}
    />
  );
}
