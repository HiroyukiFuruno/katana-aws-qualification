import type { Locale } from './locales.ts';
import japanese from './source-url-aliases.ja.json' with { type: 'json' };
import aliases from './source-url-aliases.json' with { type: 'json' };

const sourceUrlAliases: Readonly<Record<string, string>> = aliases;
const japaneseSources: Readonly<Record<string, { label: string; url: string }>> = japanese;
const originalSources = new Map(
  Object.entries(japaneseSources).map(([original, { url }]) => [url, sourceDocumentationUrl(original)]),
);

export function sourceDocumentationUrl(url: string): string {
  return Object.hasOwn(sourceUrlAliases, url) ? sourceUrlAliases[url] : url;
}

export function localizedDocumentationSource(source: { label: string; url: string }, locale: Locale) {
  const knownSource = Object.hasOwn(japaneseSources, source.url);
  if (locale === 'ja' && knownSource) {
    return { ...japaneseSources[source.url], locale: 'ja' as const };
  }
  const original = knownSource ? undefined : originalSources.get(source.url);
  if (locale === 'ja' && original) return { ...source, locale: 'ja' as const };
  return { label: source.label, url: original ?? sourceDocumentationUrl(source.url), locale: undefined };
}
