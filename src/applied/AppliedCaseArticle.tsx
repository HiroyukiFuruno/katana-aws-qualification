type Link = { href: string; label: string };
type Source = { label: string; url: string; language: string };
type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'figure'; id: string };
type Figure = { path: string; alt: string; width: number; height: number };
export type AppliedCaseContent = {
  id: string;
  title: string;
  intro: string;
  sections: { id: string; title: string; blocks: (Block & { key: string })[] }[];
  referencesTitle: string;
  sources: Source[];
};

function inline(text: string) {
  let offset = 0;
  return text.split('`').map((part, index) => {
    const start = offset;
    offset += part.length + 1;
    return index % 2 === 0 ? part : <code key={start}>{part}</code>;
  });
}

function CaseBlock({ block, figures }: { block: Block; figures: Record<string, Figure> }) {
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
    case 'figure': {
      const figure = figures[block.id];
      if (!figure) throw new Error(`Unknown applied figure: ${block.id}`);
      return (
        <figure className="applied-case-figure" lang="en">
          <img src={figure.path} alt={figure.alt} width={figure.width} height={figure.height} />
        </figure>
      );
    }
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
                <th scope="row">{name}</th>
                {values.map((value, column) => (
                  <td key={block.columns[column + 1]}>{value}</td>
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
  figures,
  back,
  foundations,
  glossary,
}: {
  lesson: AppliedCaseContent;
  figures: Record<string, Figure>;
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
            {section.blocks.map((block) => (
              <CaseBlock key={block.key} block={block} figures={figures} />
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
