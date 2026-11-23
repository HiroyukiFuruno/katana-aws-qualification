import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const endpoint = /(?:エンドポイント|\bendpoints?\b)/iu;
const zonalDns = /(?:(?<!ホスト)ゾーン(?:固有の?)?\s*DNS|\bzonal\s+DNS\b|\bzone[- ]specific\s+DNS\b)/iu;
const regional = /(?:リージョン|\bregional\b)/iu;
const bareTraditionalRegionalDns = /(?<!可用)區域\s*DNS(?:\s*名稱)?/u;
const sourceRegionalDns = /區域\s*DNS/gu;

export function assertZonalDnsLanguage(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  if (locale !== 'zh-TW') return;
  const normalizedSource = source.normalize('NFC');
  for (const match of normalizedSource.matchAll(sourceRegionalDns)) {
    if (!(match.index !== undefined && normalizedSource.slice(0, match.index).endsWith('可用'))) return;
  }
  if (!endpoint.test(source) || !zonalDns.test(source) || regional.test(source)) return;
  assert(
    !bareTraditionalRegionalDns.test(translated.normalize('NFC')),
    `${context}: Traditional Chinese zonal DNS terminology`,
  );
}
