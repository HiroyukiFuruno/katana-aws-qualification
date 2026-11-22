import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

test('Portuguese IOPS uses plural agreement or an explicit quantity noun', () => {
  const source = 'SSDのIOPSを、容量を変えずに増やす。';
  for (const translated of [
    'Aumentar a IOPS do disco FSx sem alterar a capacidade SSD',
    'A capacidade de throughput atende à IOPS desejada.',
    'Manter o IOPS atual.',
  ])
    expect(() => assertNativeLanguage(source, translated, 'pt', 'text')).toThrow(
      'Portuguese IOPS agreement',
    );
  for (const translated of [
    'Aumentar as IOPS do disco sem alterar a capacidade SSD.',
    'A capacidade de throughput atende às IOPS desejadas.',
    'Manter o número de IOPS atual.',
    'A taxa de IOPS aumenta com a capacidade.',
    'A configuração das IOPS deve respeitar os limites.',
  ])
    expect(() => assertNativeLanguage(source, translated, 'pt', 'text')).not.toThrow();
});

test('IOPS agreement check stays within Portuguese metric prose', () => {
  expect(() =>
    assertNativeLanguage('1 IOPS', 'Um IOPS representa uma operação por segundo.', 'pt', 'text'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'io1のIOPS',
      'Embora o io1 ofereça IOPS provisionadas, há outros limites.',
      'pt',
      'text',
    ),
  ).not.toThrow();
  expect(() => assertNativeLanguage('SSD容量を維持する。', 'A IOPS', 'pt', 'text')).not.toThrow();
  expect(() => assertNativeLanguage('SSD IOPS', 'A IOPS', 'en', 'text')).not.toThrow();
  expect(() =>
    assertNativeLanguage('SSD IOPS', 'Configurar o campo "IOPS".', 'pt', 'text'),
  ).not.toThrow();
});
