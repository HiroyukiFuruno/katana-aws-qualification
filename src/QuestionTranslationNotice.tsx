import type { Locale } from './locales';
import { usePreferences } from './preferences';

export function QuestionTranslationNotice({ sourceLocales }: { sourceLocales: readonly Locale[] }) {
  const { locale, t } = usePreferences();
  const languages = new Intl.DisplayNames(locale, { type: 'language' });
  return (
    <>
      {[...new Set(sourceLocales)]
        .filter((source) => source !== locale)
        .map((source) => (
          <p className="notice" role="status" key={source}>
            {t('questionTranslationPreparing', { language: languages.of(source) ?? source })}
          </p>
        ))}
    </>
  );
}
