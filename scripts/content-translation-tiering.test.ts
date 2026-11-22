import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

test('Spanish Intelligent-Tiering access tiers retain their distinction from storage classes', () => {
  const source = 'S3 Intelligent-Tieringを使い、オプションの非同期アーカイブ階層を有効にしない';
  expect(() =>
    assertNativeLanguage(
      source,
      'Usar S3 Intelligent-Tiering sin habilitar las clases de archivado asíncrono opcionales',
      'es',
      'choice C',
    ),
  ).toThrow('access tier terminology');
  expect(() =>
    assertNativeLanguage(
      source,
      'Usar S3 Intelligent-Tiering sin habilitar los niveles opcionales de archivado asíncrono',
      'es',
      'choice C',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'S3 Intelligent-Tieringは階層間を移す際にもストレージクラスは変わらない。',
      'La clase de almacenamiento S3 Intelligent-Tiering no cambia entre niveles.',
      'es',
      'concept',
    ),
  ).not.toThrow();
});
