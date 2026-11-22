import { dataMigrations } from './data-migrations';

const foundationMigration = '202611210004_learning_account_foundation.sql';
const ownerShadowMigrations = [
  '202611220001_learning_owner_shadow.sql',
  '202611220002_learning_context_helpers.sql',
  '202611220003_learning_session_grants.sql',
  '202611220004_learning_account_creation.sql',
];

export function dataEngineMigrationPhases() {
  const foundationIndex = dataMigrations.indexOf(foundationMigration);
  if (foundationIndex === -1) throw new Error('Missing learning-account foundation migration');
  const beforeShadow = dataMigrations.slice(0, foundationIndex + 1);
  const ownerShadow = dataMigrations.slice(foundationIndex + 1);
  if (ownerShadow.join(',') !== ownerShadowMigrations.join(','))
    throw new Error('Owner shadow migration sequence changed');
  return { beforeShadow, ownerShadow };
}
