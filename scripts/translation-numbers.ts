import type { Locale } from '../src/locales';
import { quantityUnits } from './translation-quantity-units';

const decimalComma = new Set<Locale>(['fr', 'de', 'es', 'it', 'pt']);
const numeric = /(?<![A-Za-z0-9_])[-−]?\d+(?:(?:[.,]\d+)|(?:[ \u00a0\u202f]\d{3}))*/gu;

function normalize(value: string, locale: Locale) {
  let token = value.replace(/[ \u00a0\u202f]/gu, '').replace('−', '-');
  const comma = token.lastIndexOf(',');
  const dot = token.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    token = token.replace(decimal === ',' ? /\./gu : /,/gu, '').replace(',', '.');
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? ',' : '.';
    const expectedDecimal = decimalComma.has(locale) ? ',' : '.';
    if (separator !== expectedDecimal && /^-?\d{1,3}(?:[.,]\d{3})+$/u.test(token))
      token = token.replace(/[.,]/gu, '');
    else token = token.replace(',', '.');
  }
  if (!/^-?\d+(?:\.\d+)?$/u.test(token)) return token;
  const [integer, fraction = ''] = token.split('.');
  const whole = integer.replace(/^(-?)0+(?=\d)/u, '$1');
  const tail = fraction.replace(/0+$/u, '');
  return tail ? `${whole}.${tail}` : whole;
}

function quantities(text: string, locale: Locale) {
  const values: string[] = [];
  const normalized = text.normalize('NFKC');
  for (const unit of quantityUnits) {
    const names = [...unit.aliases].sort((a, b) => b.length - a.length).join('|');
    const pattern = new RegExp(
      `(${numeric.source})\\s*(?:${names})(?![A-Za-z])`,
      unit.sensitive ? 'gu' : 'giu',
    );
    for (const match of normalized.matchAll(pattern)) {
      const before = normalized.slice(0, match.index);
      const after = normalized.slice(match.index + match[0].length);
      // 分数の分母・分子を、分や秒などの独立した数量と誤認しない。
      if (/\d+\s*(?:分の|분의|\/)\s*$/u.test(before)) continue;
      if (unit.scale === 60 && /^\s*(?:の|의)\s*\d/u.test(after)) continue;
      let amount = Number(normalize(match[1], locale));
      if (!Number.isFinite(amount))
        amount = Number(normalize(match[1].trim().split(/\s/u).at(-1) ?? '', locale));
      if (!Number.isFinite(amount)) continue;
      const value = amount * unit.scale;
      values.push(`${unit.dimension}:${Number(value.toPrecision(15))}`);
    }
  }
  return values;
}

export function changedTranslationNumbers(source: string, translated: string, locale: Locale) {
  const expected = quantities(source, 'en');
  const actual = quantities(translated, locale);
  const byDimension = (values: string[]) => {
    const grouped = new Map<string, string[]>();
    for (const value of values) {
      const dimension = value.slice(0, value.indexOf(':'));
      const entries = grouped.get(dimension) ?? [];
      entries.push(value);
      grouped.set(dimension, entries);
    }
    return grouped;
  };
  const expectedByDimension = byDimension(expected);
  const actualByDimension = byDimension(actual);
  const changed: string[] = [];
  // 綴りの数詞や時刻の形式変更は意味レビューで扱い、次元ごとに明示された同数の量だけを比較する。
  for (const [dimension, expectedValues] of expectedByDimension) {
    const actualValues = actualByDimension.get(dimension) ?? [];
    if (expectedValues.length !== actualValues.length) continue;
    const remaining = new Map<string, number>();
    for (const value of actualValues) remaining.set(value, (remaining.get(value) ?? 0) + 1);
    for (const value of expectedValues) {
      const count = remaining.get(value) ?? 0;
      if (count > 0) remaining.set(value, count - 1);
      else changed.push(value);
    }
  }
  return changed;
}
