import { randomUUID } from 'node:crypto';
import { records as fixture, query } from '../../scripts/dashboard-fixture';
import { aggregateDashboard } from '../../src/dashboard/aggregate';
import type { DashboardRecords } from '../../src/dashboard/eventTypes';
import { dashboardDefaults } from '../../src/dashboard/preferences';
import { readDashboardSummary } from '../../src/dashboard/summaryCodec';
import { assertDashboardEquivalent } from './dashboard-equivalence';
import { verifyDashboardSettingsRecovery } from './dashboard-settings-recovery';
import { type AuthSession, createSessions, request } from './rest-client';

async function rpc(session: AuthSession, name: string, body: object) {
  const response = await request(`/rpc/${name}`, { token: session.access_token, method: 'POST', body });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Dashboard RPC ${name} failed: ${response.status} ${JSON.stringify(value)}`);
  return value;
}

export async function verifyDashboardPostgrest() {
  const [first, second] = await createSessions();
  await rpc(first, 'initialize_learning_state', {});
  await rpc(second, 'initialize_learning_state', {});
  const records: DashboardRecords = {
    events: fixture.events.map((event) => ({
      ...event,
      eventId: randomUUID(),
      mode: event.mode === 'exam' ? 'review' : event.mode,
      context: 'practice',
      examId: null,
    })),
    exams: [],
    lessonFinals: [],
    excludedRecords: 0,
  };
  for (const event of records.events) {
    await rpc(first, 'append_learning_event', {
      p_expected_generation: 0,
      p_event: {
        event_id: event.eventId,
        schema_version: 1,
        certification_id: event.certificationId,
        question_id: event.questionId,
        question_revision: event.questionRevision,
        source_version: event.sourceVersion,
        category: event.category,
        mode: event.mode,
        answered_at: event.answeredAt,
        selected: [event.isCorrect ? 'C' : 'W'],
        correct: ['C'],
        is_correct: event.isCorrect,
        duration_ms: event.durationMs,
        attempt_number: 1,
        prior_incorrect_count: 0,
        review_correct: event.mode === 'review' ? event.isCorrect : null,
        reward: event.isCorrect ? 1 : 0,
      },
    });
  }
  const queries = [
    query,
    { ...query, certificationIds: ['saa-c03'] },
    { ...query, categories: ['ai'] },
    { ...query, modes: ['review'] as const },
    { ...query, contexts: ['practice'] as const },
    { ...query, formats: ['choice-single'] as const },
    { ...query, polarities: ['incorrect'] as const },
    { ...query, unitIds: ['fundamentals.cloud-concepts'] },
    { ...query, revisions: [{ sourceVersion: 'v2', questionRevision: 1 }] },
    { ...query, range: { ...query.range, to: '2026-11-19T15:00:00Z' } },
  ];
  for (const candidate of queries) {
    const scoped = {
      ...candidate,
      modes: candidate.modes && [...candidate.modes],
      contexts: candidate.contexts && [...candidate.contexts],
      formats: candidate.formats && [...candidate.formats],
      polarities: candidate.polarities && [...candidate.polarities],
    };
    const result = readDashboardSummary(
      await rpc(first, 'dashboard_summary', { p_query: scoped, p_expected_generation: 0 }),
      scoped,
    );
    assertDashboardEquivalent(result, aggregateDashboard(records, scoped));
  }
  const other = readDashboardSummary(
    await rpc(second, 'dashboard_summary', { p_query: query, p_expected_generation: 0 }),
    query,
  );
  assertDashboardEquivalent(
    other,
    aggregateDashboard({ events: [], exams: [], lessonFinals: [], excludedRecords: 0 }, query),
  );
  const settings = dashboardDefaults('Asia/Tokyo');
  const save = { p_settings: settings, p_expected_revision: 0, p_expected_generation: 0 };
  const saved = await rpc(first, 'save_dashboard_settings', save);
  assertDashboardEquivalent(saved, { revision: 1, settings });
  assertDashboardEquivalent(await rpc(first, 'save_dashboard_settings', save), saved);
  assertDashboardEquivalent(await rpc(second, 'load_dashboard_settings', { p_expected_generation: 0 }), {
    revision: 0,
    settings: null,
  });
  const conflict = await request('/rpc/save_dashboard_settings', {
    token: first.access_token,
    method: 'POST',
    body: { ...save, p_settings: dashboardDefaults('UTC') },
  });
  const error = (await conflict.json()) as { code?: string };
  if (conflict.ok || error.code !== 'PT412')
    throw new Error('Dashboard stale revision was not rejected.');
  await rpc(first, 'reset_my_learning_data', { p_expected_generation: 0 });
  assertDashboardEquivalent(
    await rpc(first, 'load_dashboard_settings', { p_expected_generation: 1 }),
    saved,
  );
  await verifyDashboardSettingsRecovery(first, settings);
  console.log(
    'Dashboard PostgREST: 10 shared guest/SQL scopes, owner isolation, settings retry/conflict/reset retention verified.',
  );
}
