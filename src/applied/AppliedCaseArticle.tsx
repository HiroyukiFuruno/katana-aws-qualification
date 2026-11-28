import type { Locale } from '../locales.ts';
import { AppliedSectionContent, inlineCaseText } from './AppliedSectionContent.tsx';
import type { AppliedCaseContent } from './types.ts';

type Link = { href: string; label: string };

export function AppliedCaseArticle({
  lesson,
  locale,
  back,
  slides,
  foundations,
  glossary,
}: {
  lesson: AppliedCaseContent;
  locale: Locale;
  back: Link;
  slides: Link;
  foundations: Link[];
  glossary: Link[];
}) {
  return (
    <main id="main" className="shell applied-case">
      <article className="applied-case-article">
        <header>
          <a className="applied-case-back" href={back.href}>
            {back.label}
          </a>
          <h1>{lesson.title}</h1>
          <p>{lesson.intro}</p>
          <a className="action-button" href={slides.href}>
            {slides.label}
          </a>
        </header>
        <nav aria-label={lesson.title}>
          <ul className="applied-case-sections">
            {lesson.sections.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ul>
        </nav>
        {lesson.sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="applied-case-section">
            <h2 id={section.id}>{section.title}</h2>
            <AppliedSectionContent lessonId={lesson.id} section={section} locale={locale} />
          </section>
        ))}
        <section id="references" className="applied-case-section">
          <h2>{lesson.referencesTitle}</h2>
          <ul>
            {foundations.map(({ href, label }) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
            {lesson.sources.map(({ label, url, language }) => (
              <li key={url}>
                <a href={url} hrefLang={language} target="_blank" rel="noreferrer">
                  {inlineCaseText(label)}
                </a>
              </li>
            ))}
          </ul>
          <ul className="applied-case-terms">
            {glossary.map(({ href, label }) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
