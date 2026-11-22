import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

test('明示された正解率を適合率の訳語だけへ変えない', () => {
  for (const [locale, translated] of [
    ['pt', 'O modelo tem 99% de precisão no treinamento e 62% na validação.'],
    ['fr', 'Le modèle a une précision de 99 % en entraînement et de 62 % en validation.'],
    ['es', 'El modelo tiene una precisión del 99 % en entrenamiento y del 62 % en validación.'],
  ] as const)
    for (const source of [
      '画像分類モデルは訓練データで99%正解だが、検証データでは62%である。',
      '分類モデルは９９ ％正解である。',
      'Evaluate classification accuracy.',
    ])
      expect(() => assertNativeLanguage(source, translated, locale, 'prompt')).toThrow(
        'classification accuracy terminology',
      );
});

test('正解率を曖昧にしない自然な表現と明示した英語指標を許容する', () => {
  for (const [locale, translated] of [
    ['pt', 'A acurácia é a proporção de previsões corretas.'],
    ['fr', 'Le taux de bonnes prédictions est calculé sur tous les exemples.'],
    ['es', 'La exactitud es la proporción de predicciones correctas.'],
    ['fr', 'La précision globale (accuracy) est de 99 %.'],
  ] as const)
    expect(() => assertNativeLanguage('正解率を評価する。', translated, locale, 'text')).not.toThrow();
});

test('適合率や一般的な精度を禁止せず複数指標の説明も許容する', () => {
  for (const [locale, term] of [
    ['pt', 'precisão'],
    ['fr', 'précision'],
    ['es', 'precisión'],
  ] as const) {
    for (const source of [
      '適合率は予測した陽性のうち正しいものの割合である。',
      'センサーの精度を評価する。',
      '不正解率を評価する。',
      '正解率と適合率を比較する。',
      'Compare accuracy and precision.',
    ])
      expect(() => assertNativeLanguage(source, term, locale, 'text')).not.toThrow();
  }
});
