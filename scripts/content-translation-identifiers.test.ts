import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';
import { translationIdentifiers } from './translation-identifiers';

test('translation preserves standalone API actions and snake_case field names', () => {
  const source = { text: 'ReportBatchItemFailuresを有効にし、tenant_idを返す。' };
  expect(() =>
    validateTranslation(
      source,
      { text: 'Activez ReportBatchItemFailures et renvoyez tenant_id.' },
      'fr',
      'identifier',
    ),
  ).not.toThrow();
  expect(() =>
    validateTranslation(source, { text: 'Use ReportBatchItemsFailure and tenant_id.' }, 'en', 'api'),
  ).toThrow('technical token lost: ReportBatchItemFailures');
  expect(() =>
    validateTranslation(source, { text: 'Use ReportBatchItemFailures and tenantId.' }, 'en', 'field'),
  ).toThrow('technical token lost: tenant_id');
});

test('Redshift RG and RA3 are required technical identifiers', () => {
  const source = 'RedshiftのRGまたはRA3ノードを選択する。';
  expect(() =>
    validateTranslation(source, 'Select the Redshift RG or RA3 node.', 'en', 'redshift'),
  ).not.toThrow();
  expect(() => validateTranslation(source, 'Select the Redshift RA3 node.', 'en', 'redshift')).toThrow(
    'technical token lost: RG',
  );
  expect(() => validateTranslation(source, 'Select the Redshift RG node.', 'en', 'redshift')).toThrow(
    'technical token lost: RA3',
  );
  expect(translationIdentifiers(source)).toEqual(['RG', 'RA3']);
});

test('RG and RA3 remain out of scope for non-Redshift text', () => {
  expect(translationIdentifiers('RG eligibility is documented.')).not.toContain('RG');
  expect(translationIdentifiers('RA3 eligibility is documented.')).not.toContain('RA3');
});
