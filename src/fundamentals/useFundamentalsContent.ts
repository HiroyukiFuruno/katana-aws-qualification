import { useEffect, useState } from 'react';
import { validFundamentalsContent } from './content';
import type { FundamentalsContent } from './types';

const contentUrl = '/fundamentals/content.json';

export function useFundamentalsContent() {
  const [content, setContent] = useState<FundamentalsContent>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const source = retry ? `${contentUrl}?retry=${retry}` : contentUrl;

  useEffect(() => {
    let cancelled = false;
    fetch(source, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('load'))))
      .then((value: unknown) => {
        if (!cancelled && validFundamentalsContent(value)) setContent(value);
        else if (!cancelled) setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  function reload() {
    setError(false);
    setRetry((current) => current + 1);
  }

  return { content, error, reload };
}
