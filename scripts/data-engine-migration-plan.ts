import { dataMigrations } from './data-migrations';

const ownerShadowStartMigration = '202611220001_learning_owner_shadow.sql';
const ownerShadowMigrations = [
  '202611220001_learning_owner_shadow.sql',
  '202611220002_learning_context_helpers.sql',
  '202611220003_learning_session_grants.sql',
  '202611220004_learning_account_creation.sql',
];

export function dataEngineMigrationPhases() {
  const ownerShadowIndex = dataMigrations.indexOf(ownerShadowStartMigration);
  if (ownerShadowIndex === -1) throw new Error('Missing learning-owner shadow migration');
  const beforeShadow = dataMigrations.slice(0, ownerShadowIndex);
  const ownerShadow = dataMigrations.slice(ownerShadowIndex);
  if (ownerShadow.join(',') !== ownerShadowMigrations.join(','))
    throw new Error('Owner shadow migration sequence changed');
  return { beforeShadow, ownerShadow };
}
