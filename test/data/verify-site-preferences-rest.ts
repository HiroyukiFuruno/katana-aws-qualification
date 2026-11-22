import { dashboardDefaults } from '../../src/dashboard/preferences';
import { assertDashboardEquivalent } from './dashboard-equivalence';
import { type AuthSession, createSessions, request } from './rest-client';

type SitePreferences = { locale: string | null; theme: string | null; revision: number };

async function rpc(session: AuthSession, name: string, body: object) {
  const response = await request(`/rpc/${name}`, { token: session.access_token, method: 'POST', body });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Site preferences RPC ${name} failed: ${response.status} ${JSON.stringify(value)}`);
  return value;
}

async function expectCode(response: Response, code: string, label: string) {
  const value = (await response.json()) as { code?: string };
  if (response.ok || value.code !== code) throw new Error(`${label} did not return ${code}`);
}

function preferences(value: unknown): asserts value is SitePreferences {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as SitePreferences).revision !== 'number' ||
    !('locale' in value) ||
    !('theme' in value)
  )
    throw new Error('Site preferences RPC returned an invalid shape.');
}

function assertPreferences(value: unknown, expected: SitePreferences) {
  preferences(value);
  if (
    value.locale !== expected.locale ||
    value.theme !== expected.theme ||
    value.revision !== expected.revision
  )
    throw new Error('Site preferences RPC returned the wrong value.');
}

export async function verifySitePreferencesPostgrest() {
  const [first, second] = await createSessions();
  await rpc(first, 'initialize_learning_state', {});
  await rpc(second, 'initialize_learning_state', {});
  const initial = await rpc(first, 'load_site_preferences', { p_expected_generation: 0 });
  assertPreferences(initial, { locale: null, theme: null, revision: 0 });
  const other = await rpc(second, 'load_site_preferences', { p_expected_generation: 0 });
  assertPreferences(other, { locale: null, theme: null, revision: 0 });
  await expectCode(
    await request('/rpc/save_site_preferences', {
      method: 'POST',
      body: { p_locale: 'ja', p_theme: 'dark', p_expected_revision: 0, p_expected_generation: 0 },
    }),
    '42501',
    'Anonymous site preference save',
  );
  const saved = await rpc(first, 'save_site_preferences', {
    p_locale: 'ja',
    p_theme: 'dark',
    p_expected_revision: 0,
    p_expected_generation: 0,
  });
  assertPreferences(saved, { locale: 'ja', theme: 'dark', revision: 1 });
  assertPreferences(await rpc(second, 'load_site_preferences', { p_expected_generation: 0 }), {
    locale: null,
    theme: null,
    revision: 0,
  });
  const direct = await request(`/dashboard_settings?user_id=eq.${first.user.id}`, {
    token: first.access_token,
    method: 'PATCH',
    body: { site_locale: 'fr' },
  });
  if (direct.ok) throw new Error('PostgREST allowed a direct site preference update.');
  for (const [locale, theme, revision] of [
    ['en-US', 'dark', 1],
    ['ja', 'system', 1],
    ['ja', 'dark', -1],
  ])
    await expectCode(
      await request('/rpc/save_site_preferences', {
        token: first.access_token,
        method: 'POST',
        body: {
          p_locale: locale,
          p_theme: theme,
          p_expected_revision: revision,
          p_expected_generation: 0,
        },
      }),
      '22023',
      'Invalid site preference input',
    );
  const layout = dashboardDefaults('Asia/Tokyo');
  await rpc(first, 'save_dashboard_settings', {
    p_settings: layout,
    p_expected_revision: 0,
    p_expected_generation: 0,
  });
  const writes = await Promise.all(
    [
      ['fr', 'light'],
      ['de', 'dark'],
    ].map(async ([locale, theme]) => {
      const response = await request('/rpc/save_site_preferences', {
        token: first.access_token,
        method: 'POST',
        body: { p_locale: locale, p_theme: theme, p_expected_revision: 1, p_expected_generation: 0 },
      });
      return { response, value: await response.json() };
    }),
  );
  if (
    writes.filter(({ response }) => response.ok).length !== 1 ||
    writes.filter(({ response }) => !response.ok).length !== 1
  )
    throw new Error('Concurrent site preference CAS did not produce exactly one winner.');
  const loser = writes.find(({ response }) => !response.ok)?.value as { code?: string } | undefined;
  if (loser?.code !== 'PT412') throw new Error('Concurrent site preference loser was not stale.');
  const current = await rpc(first, 'load_site_preferences', { p_expected_generation: 0 });
  preferences(current);
  if (current.revision !== 2 || !['fr', 'de'].includes(current.locale ?? ''))
    throw new Error('Concurrent site preference winner was not persisted.');
  assertDashboardEquivalent(await rpc(first, 'load_dashboard_settings', { p_expected_generation: 0 }), {
    revision: 1,
    settings: layout,
  });
  const cleared = await rpc(first, 'save_site_preferences', {
    p_locale: null,
    p_theme: null,
    p_expected_revision: 2,
    p_expected_generation: 0,
  });
  assertPreferences(cleared, { locale: null, theme: null, revision: 3 });
  preferences(cleared);
  await rpc(first, 'reset_my_learning_data', { p_expected_generation: 0 });
  const afterReset = await rpc(first, 'load_site_preferences', { p_expected_generation: 1 });
  assertPreferences(afterReset, cleared);
  await expectCode(
    await request('/rpc/load_site_preferences', {
      token: first.access_token,
      method: 'POST',
      body: { p_expected_generation: 0 },
    }),
    'PT409',
    'Stale site preference generation',
  );
  console.log('Site preferences PostgREST: two users, RLS, validation, CAS, reset retention verified.');
}
