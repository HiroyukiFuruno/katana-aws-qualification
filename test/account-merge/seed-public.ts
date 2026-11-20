import { readFileSync } from 'node:fs';
import { dashboardDefaults } from '../../src/dashboard/preferences';
import { sql } from './commands';
import { gatewayOrigin, testKey } from './settings';

const seedEmail = 'migration-seed@account-merge.example.test';
const ownerTables = [
  'learning_state',
  'learning_events',
  'exam_sessions',
  'exam_responses',
  'earned_certifications',
  'assessment_answers',
  'roadmap_profiles',
  'migration_manifests',
  'migration_items',
  'fundamentals_unit_progress',
  'fundamentals_final_sessions',
  'dashboard_settings',
] as const;

async function admin(method: 'GET' | 'POST' | 'DELETE', userId = '') {
  const token = testKey('service_role');
  return fetch(`${gatewayOrigin}/auth/v1/admin/users${userId ? `/${userId}` : ''}`, {
    method,
    headers: { apikey: token, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ email: seedEmail, email_confirm: true }) : undefined,
  });
}

async function verifiedAdminUser(response: Response) {
  if (!response.ok) throw new Error(`Synthetic seed user API failed (${response.status})`);
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    !('email' in value) ||
    typeof value.id !== 'string' ||
    value.email !== seedEmail ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value.id)
  ) {
    throw new Error('Unexpected synthetic seed user response');
  }
  return value.id;
}

function verifyCascade(userId: string) {
  const remaining = ownerTables.map(
    (table) => `exists(select 1 from public.${table} where user_id = '${userId}')`,
  );
  remaining.push(`exists(select 1 from auth.users where id = '${userId}')`);
  if (sql(`select ${remaining.join(' or ')}`) !== 'f') {
    throw new Error('Synthetic seed cleanup left Auth or public owner rows');
  }
}

export async function seedPublicData() {
  const userId = await verifiedAdminUser(await admin('POST'));
  const cleanup = async () => {
    const current = await admin('GET', userId);
    if (current.status !== 404) {
      if ((await verifiedAdminUser(current)) !== userId) throw new Error('Synthetic seed owner changed');
      const deletion = await admin('DELETE', userId);
      if (!deletion.ok) throw new Error(`Synthetic seed deletion failed (${deletion.status})`);
    }
    const confirmation = await admin('GET', userId);
    if (confirmation.status !== 404) throw new Error('Synthetic seed Auth deletion was not confirmed');
    verifyCascade(userId);
  };
  try {
    const settings = JSON.stringify(dashboardDefaults('UTC')).replaceAll("'", "''");
    const statement = readFileSync(new URL('./seed-public.sql', import.meta.url), 'utf8')
      .replaceAll('__SEED_USER_ID__', userId)
      .replaceAll('__DASHBOARD_SETTINGS__', settings);
    sql(statement);
    return { userId, cleanup };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Synthetic seed and its cleanup failed');
    }
    throw error;
  }
}
