import { usePreferences } from '../preferences';
import { localizedDocumentationSource } from '../sourceDocumentationUrl';
import type { FundamentalsSection as Section } from './types';

export function FundamentalsSection({ section }: { section: Section }) {
  const { locale, t } = usePreferences();
  const source = localizedDocumentationSource(section.source, locale);
  return (
    <section className="card fundamentals-reading-section" aria-labelledby={`lesson-${section.id}`}>
      <h2 id={`lesson-${section.id}`}>{section.title}</h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <div className="fundamentals-worked-example">
        <h3>{t('fundamentalsExample')}</h3>
        <p>{section.example.scenario}</p>
        <ol>
          {section.example.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>{section.example.outcome}</p>
      </div>
      <div className="fundamentals-misconception">
        <h3>{t('fundamentalsCommonMisconception')}</h3>
        <p>
          <s>{section.misconception.claim}</s>
        </p>
        <p>{section.misconception.correction}</p>
      </div>
      <h3>{t('fundamentalsTakeaways')}</h3>
      <ul>
        {section.takeaways.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a href={source.url} hrefLang={source.locale} target="_blank" rel="noreferrer">
        {source.label}
      </a>
    </section>
  );
}
