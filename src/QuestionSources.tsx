import { usePreferences } from './preferences';
import { questionAdditionalSources } from './questionAdditionalSources';
import type { Question } from './questions';
import { sourceDocumentationUrl } from './sourceDocumentationUrl';

export function QuestionSources({ question }: { question: Question }) {
  const { locale, t } = usePreferences();
  const sources = [
    { ...question.source, locale: question.locale },
    ...(question.references ?? []).map((source) => ({ ...source, locale: question.locale })),
    ...questionAdditionalSources(question).map((source) => ({
      ...source,
      label: t('sourceDocumentation', { name: source.label }),
      locale,
    })),
  ];
  const links = sources.map((source) => (
    <a
      lang={source.locale}
      key={source.url}
      href={sourceDocumentationUrl(source.url)}
      target="_blank"
      rel="noreferrer"
    >
      {source.label} ↗
    </a>
  ));
  return sources.length === 1 ? (
    links[0]
  ) : (
    <ul>
      {links.map((link) => (
        <li key={link.key}>{link}</li>
      ))}
    </ul>
  );
}
