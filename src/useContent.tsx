import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SiteContent } from './contentTypes';
import type { Locale } from './locales';
import { usePreferences } from './preferences';

const Content = createContext<SiteContent | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const { locale, t } = usePreferences();
  const [loaded, setLoaded] = useState<{ locale: Locale; content: SiteContent }>();
  const [failed, setFailed] = useState<Locale>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/translations/${locale}/site.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('loadContentError');
        const content: SiteContent = await response.json();
        if (
          !content.certifications ||
          !content.guides ||
          !content.skills ||
          !content.glossary ||
          !content.assessment ||
          !content.labels
        )
          throw new Error('loadContentError');
        if (!controller.signal.aborted) setLoaded({ locale, content });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(locale);
      });
    return () => controller.abort();
  }, [locale]);
  const ready = loaded?.locale === locale;
  return (
    <Content.Provider value={loaded?.content}>
      {!ready && (
        <main id="content-loading" className="shell">
          <p role={failed === locale ? 'alert' : 'status'}>
            {t(failed === locale ? 'loadContentError' : 'loadingContent')}
          </p>
        </main>
      )}
      {loaded && (
        <div style={{ display: ready ? 'contents' : 'none' }} inert={!ready}>
          {children}
        </div>
      )}
    </Content.Provider>
  );
}

export function useContent() {
  const content = useContext(Content);
  if (!content) throw new Error('ContentProvider required');
  return { content, loading: false, error: false };
}
