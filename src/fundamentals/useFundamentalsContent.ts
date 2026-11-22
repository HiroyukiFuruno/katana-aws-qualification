import { useEffect, useState } from 'react';
import { usePreferences } from '../preferences';
import { validFundamentalsContent } from './content';
import { overlayFundamentalsContent } from './contentLocalization';
import type { FundamentalsContent } from './types';

const contentUrl = '/fundamentals/content.json';

export function useFundamentalsContent() {
  const { locale } = usePreferences();
  const [content, setContent] = useState<FundamentalsContent>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const source = retry ? `${contentUrl}?retry=${retry}` : contentUrl;

  useEffect(() => {
    let cancelled = false;
    fetch(source, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('load'))))
      .then(async (value: unknown) => {
        if (!validFundamentalsContent(value)) throw new Error('load');
        if (locale === 'ja') return value;
        const translation = await fetch(`/translations/${locale}${contentUrl}`, { cache: 'no-cache' });
        if (!translation.ok) throw new Error('load');
        const localized: unknown = await translation.json();
        if (!validFundamentalsContent(localized)) throw new Error('load');
        return overlayFundamentalsContent(value, localized);
      })
      .then((value) => {
        if (!cancelled) setContent(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, source]);

  function reload() {
    setError(false);
    setRetry((current) => current + 1);
  }

  return { content, error, reload };
}
