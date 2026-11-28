import { Fragment } from 'react';
import { imageSlot } from '../images/catalog.ts';
import { ImageSlot } from '../images/ImageSlot.ts';
import type { Locale } from '../locales.ts';
import type { AppliedBlock, AppliedCaseContent } from './types.ts';

export function inlineCaseText(text: string) {
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
      return <p>{inlineCaseText(block.text)}</p>;
    case 'steps':
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>{inlineCaseText(item)}</li>
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
                <th scope="row">{inlineCaseText(name)}</th>
                {values.map((value, column) => (
                  <td key={block.columns[column + 1]}>{inlineCaseText(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

export function AppliedSectionContent({
  lessonId,
  section,
  locale,
}: {
  lessonId: string;
  section: AppliedCaseContent['sections'][number];
  locale: Locale;
}) {
  return (
    <>
      <ImageSlot id={imageSlot('applied', lessonId, section.id, 'start')} locale={locale} />
      {section.blocks.map((block) => (
        <Fragment key={block.key}>
          <CaseBlock block={block} />
          <ImageSlot id={imageSlot('applied', lessonId, section.id, block.key)} locale={locale} />
        </Fragment>
      ))}
    </>
  );
}
