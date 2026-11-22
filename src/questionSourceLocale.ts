import { type Locale, locales } from './locales';
import sourceLocales from './question-source-locales.json';

const supportedLocales = new Set<string>(locales);

function declaredSourceLocale(value: unknown, filename: string): Locale {
  if (typeof value === 'string' && supportedLocales.has(value)) return value as Locale;
  throw new Error(`Invalid question source locale: ${filename}`);
}

export function validateSourceLocaleDeclarations(declarations: Readonly<Record<string, unknown>>) {
  for (const [filename, value] of Object.entries(declarations)) declaredSourceLocale(value, filename);
}

validateSourceLocaleDeclarations(sourceLocales);

export function sourceLocaleOf(filename: string): Locale {
  if (!Object.hasOwn(sourceLocales, filename)) return 'ja';
  return declaredSourceLocale((sourceLocales as Record<string, unknown>)[filename], filename);
}
