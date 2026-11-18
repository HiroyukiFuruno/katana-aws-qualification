import type { certifications } from './certifications';
import type { Locale } from './locales';

type Level = (typeof certifications)[number]['level'];

const standardPrice: Record<Level, { jpy: number; usd: number }> = {
  基礎: { jpy: 15_000, usd: 100 },
  アソシエイト: { jpy: 20_000, usd: 150 },
  プロフェッショナル: { jpy: 40_000, usd: 300 },
  専門: { jpy: 40_000, usd: 300 },
  ビジネス: { jpy: 15_000, usd: 100 },
};

const betaPrice: Partial<Record<string, number>> = { 'ai-business-strategist': 50 };

function formatPrice(locale: Locale, currency: 'JPY' | 'USD', amount: number) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: locale === 'ja' && currency === 'JPY' ? 'name' : 'code',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function examPrices(certification: (typeof certifications)[number], locale: Locale) {
  const { jpy, usd } = standardPrice[certification.level];
  const beta = certification.beta ? betaPrice[certification.id] : undefined;
  return {
    standard: `${formatPrice(locale, 'JPY', jpy)} / ${formatPrice(locale, 'USD', usd)}`,
    beta: beta === undefined ? undefined : formatPrice(locale, 'USD', beta),
  };
}

const pricingLocales: Partial<Record<Locale, string>> = {
  ja: 'jp',
  'zh-CN': 'cn',
  'zh-TW': 'tw',
  ko: 'ko',
  pt: 'pt',
  fr: 'fr',
  de: 'de',
  es: 'es',
  it: 'it',
};

export function pricingUrl(locale: Locale) {
  const prefix = pricingLocales[locale];
  return `https://aws.amazon.com/${prefix ? `${prefix}/` : ''}certification/policies/before-testing/`;
}
