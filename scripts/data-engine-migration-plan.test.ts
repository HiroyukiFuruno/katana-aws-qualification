import { expect, test } from 'bun:test';
import { dataEngineMigrationPhases } from './data-engine-migration-plan';
import { dataMigrations } from './data-migrations';

test('splits the registered migration sequence without skipping presentation or duplicating a migration', () => {
  const { beforeShadow, ownerShadow } = dataEngineMigrationPhases();

  expect(beforeShadow.at(-1)).toBe('202611210005_presentation_storage.sql');
  expect(ownerShadow).toEqual([
    '202611220001_learning_owner_shadow.sql',
    '202611220002_learning_context_helpers.sql',
    '202611220003_learning_session_grants.sql',
    '202611220004_learning_account_creation.sql',
  ]);
  expect([...beforeShadow, ...ownerShadow]).toEqual(dataMigrations);
  expect(new Set([...beforeShadow, ...ownerShadow]).size).toBe(dataMigrations.length);
});
