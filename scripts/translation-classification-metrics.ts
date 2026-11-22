import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const metricTerms: Partial<Record<Locale, { precision: RegExp; accuracy: RegExp }>> = {
  pt: {
    precision: /(?<![\p{L}\p{N}_])precisão(?![\p{L}\p{N}_])/iu,
    accuracy: /acurácia|exatidão|\baccuracy\b/iu,
  },
  fr: {
    precision: /(?<![\p{L}\p{N}_])précision(?![\p{L}\p{N}_])/iu,
    accuracy: /exactitude|justesse|taux de (?:bonnes prédictions|prédictions correctes)|\baccuracy\b/iu,
  },
  es: {
    precision: /(?<![\p{L}\p{N}_])precisión(?![\p{L}\p{N}_])/iu,
    accuracy: /exactitud|tasa de (?:aciertos|predicciones correctas)|\baccuracy\b/iu,
  },
};

export function assertClassificationMetrics(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  const rule = metricTerms[locale];
  if (!rule) return;
  const normalized = source.normalize('NFKC');
  // 精度一般や複数指標の説明は単語だけで誤訳と判定できない。
  if (
    !/(?<!不)正解率|\d+(?:\.\d+)?\s*%\s*正解|\baccuracy\b/iu.test(normalized) ||
    /適合率|\bprecision\b/iu.test(normalized) ||
    rule.precision.test(source)
  )
    return;
  assert(
    !rule.precision.test(translated) || rule.accuracy.test(translated),
    `${context}: classification accuracy terminology`,
  );
}
