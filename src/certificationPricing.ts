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

export const yenExchangeSource =
  'https://www.boj.or.jp/statistics/market/forex/fxdaily/fxlist/fx261118.pdf';
const yenExchange = { date: '2026-11-18', jpyPerUsd: 159.35 };

const betaPrice: Partial<Record<string, number>> = { 'ai-business-strategist': 50 };

function formatPrice(locale: Locale, currency: 'JPY' | 'USD', amount: number) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function examPrices(certification: (typeof certifications)[number], locale: Locale) {
  const { jpy, usd } = standardPrice[certification.level];
  const beta = certification.beta ? betaPrice[certification.id] : undefined;
  const converted = (dollars: number) =>
    `${formatPrice(locale, 'USD', dollars)} ≈ ${formatPrice(locale, 'JPY', Math.round(dollars * yenExchange.jpyPerUsd))}`;
  return {
    conversion: [beta === undefined ? undefined : converted(beta), converted(usd)]
      .filter(Boolean)
      .join(' / '),
    rate: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(yenExchange.jpyPerUsd),
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Tokyo' }).format(
      new Date(yenExchange.date),
    ),
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
