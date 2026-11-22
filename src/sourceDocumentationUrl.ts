import aliases from './source-url-aliases.json' with { type: 'json' };

const sourceUrlAliases: Readonly<Record<string, string>> = aliases;

export function sourceDocumentationUrl(url: string): string {
  return Object.hasOwn(sourceUrlAliases, url) ? sourceUrlAliases[url] : url;
}
