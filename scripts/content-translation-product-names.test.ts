import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('FSx file system names retain the official Lustre spelling', () => {
  const source = 'Windows File ServerやLustreなどを提供する。';
  expect(() =>
    validateTranslation(
      source,
      'Provides file systems such as Windows File Server and Luster.',
      'en',
      'fsx',
    ),
  ).toThrow('technical token lost: Lustre');
  expect(() =>
    validateTranslation(
      source,
      'Provides file systems such as Windows File Server and Lustre.',
      'en',
      'fsx',
    ),
  ).not.toThrow();
});
