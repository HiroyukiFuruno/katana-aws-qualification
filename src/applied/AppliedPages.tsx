import { termAnchor } from '../glossaryAnchor';
import { type Locale, localePath } from '../locales.ts';
import { AppliedCaseArticle } from './AppliedCaseArticle';
import { AppliedCaseSlides } from './AppliedCaseSlides';
import { AppliedDirectoryPage } from './AppliedDirectoryPage';
import { appliedContentFor, appliedResourcesFor } from './cases.ts';
import { appliedCaseForPage, appliedDirectory, appliedIndexPage, appliedSlideHref } from './routes.ts';
import { appliedSlideCopy } from './slideContent.ts';

export default function AppliedPages({
  page,
  locale,
  slides = false,
  interactive = false,
  requestedStep,
}: {
  page: string;
  locale: Locale;
  slides?: boolean;
  interactive?: boolean;
  requestedStep?: string;
}) {
  const directory = appliedDirectory(locale);
  if (page === appliedIndexPage)
    return <AppliedDirectoryPage locale={locale} interactive={interactive} />;

  const entry = appliedCaseForPage(locale, page);
  if (!entry) throw new Error(`Unknown applied page: ${page}`);
  const lesson = appliedContentFor(locale, entry.id);
  const articleHref = localePath(locale, entry.page);
  if (slides)
    return (
      <AppliedCaseSlides
        lesson={lesson}
        locale={locale}
        articleHref={articleHref}
        requestedStep={requestedStep}
      />
    );
  return (
    <AppliedCaseArticle
      lesson={lesson}
      locale={locale}
      back={{ href: localePath(locale, appliedIndexPage), label: directory.title }}
      slides={{ href: appliedSlideHref(articleHref), label: appliedSlideCopy(locale).open }}
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
