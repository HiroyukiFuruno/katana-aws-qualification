import { Fragment } from 'react';
import { imageSlot } from '../images/catalog.ts';
import { ImageSlot } from '../images/ImageSlot.ts';
import type { Locale } from '../locales.ts';
import type { AppliedBlock, AppliedCaseContent } from './types.ts';

type Link = { href: string; label: string };

function inline(text: string) {
  let offset = 0;
  return text.split('`').map((part, index) => {
    const start = offset;
    offset += part.length + 1;
    return index % 2 === 0 ? part : <code key={start}>{part}</code>;
  });
}

function CaseBlock({ block }: { block: AppliedBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <p>{inline(block.text)}</p>;
    case 'steps':
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <table className="applied-case-table">
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map(([name, ...values]) => (
              <tr key={name}>
                <th scope="row">{inline(name)}</th>
                {values.map((value, column) => (
                  <td key={block.columns[column + 1]}>{inline(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

export function AppliedCaseArticle({
  lesson,
  locale,
  back,
  foundations,
  glossary,
}: {
  lesson: AppliedCaseContent;
  locale: Locale;
  back: Link;
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
            <ImageSlot id={imageSlot('applied', lesson.id, section.id, 'start')} locale={locale} />
            {section.blocks.map((block) => (
              <Fragment key={block.key}>
                <CaseBlock block={block} />
                <ImageSlot id={imageSlot('applied', lesson.id, section.id, block.key)} locale={locale} />
              </Fragment>
            ))}
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
                  {inline(label)}
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
