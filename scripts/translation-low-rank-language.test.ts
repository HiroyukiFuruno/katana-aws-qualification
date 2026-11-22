import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

test('LoRAの低ランクアダプターをポルトガル語で組織の階級と訳さない', () => {
  expect(() =>
    assertNativeLanguage(
      'LoRAでベースの重みを固定し、部署ごとの低ランクアダプターを訓練する。',
      'Usar LoRA para congelar os pesos de base e treinar adaptadores de baixo escalão para cada departamento.',
      'pt',
      'choices[0].text',
    ),
  ).toThrow('Portuguese LoRA rank terminology');
});

test('数学上のrank表現と本来の組織階級および指定されたliteralを区別する', () => {
  const source = 'LoRAの低ランクアダプターを下位階層の部署へ割り当てる。';
  for (const translated of [
    'Usar LoRA com adaptadores de baixo posto para os departamentos.',
    'Usar LoRA com adaptadores low-rank para os departamentos.',
    'Usar LoRA com adaptadores de baixo posto para os departamentos de baixo escalão.',
  ])
    expect(() => assertNativeLanguage(source, translated, 'pt', 'text')).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      '下位階層の部署へ割り当てる。',
      'Departamentos de baixo escalão.',
      'pt',
      'text',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'LoRAの低ランクアダプターのラベル「adaptadores de baixo escalão」を保持する。',
      'Manter o rótulo "adaptadores de baixo escalão" no LoRA.',
      'pt',
      'text',
    ),
  ).not.toThrow();
});
