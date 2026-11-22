import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

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
