import { fixtureKey, gatewayOrigin } from './settings';

export const historyKey = 'saa-study.attempts.v1';
export const validAttempt = {
  schemaVersion: 1,
  questionId: 'mock-secure-01',
  questionRevision: 2,
  category: 'セキュリティ',
  sourceVersion: 'SAA-C03 mock / 2026-11 v2',
  answeredAt: '2026-11-20T00:00:00+00:00',
  selected: ['A'],
  correct: ['A'],
  isCorrect: true,
  durationMs: 1200,
  attemptNumber: 1,
  priorIncorrectCount: 0,
  mode: 'study',
  reviewCorrect: null,
  reward: 1,
};
type Session = { accessToken: string };
type Manifest = { manifest_id: string; status: string; declared_rows: number };
type MigrationItem = { source_row_id: string; outcome: string; reason_code: string | null };
type LearningEvent = {
  certification_id: string;
  question_id: string;
  question_revision: number;
  selected: string[];
  is_correct: boolean;
};
async function rows<T>(path: string, session: Session) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/${path}`, {
    headers: { apikey: fixtureKey('anon'), Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) throw new Error(`PostgREST read failed: ${response.status}`);
  return (await response.json()) as T[];
}
export function manifests(session: Session) {
  return rows<Manifest>(
    'migration_manifests?source_name=eq.history-local-storage&select=manifest_id,status,declared_rows',
    session,
  );
}
export function items(session: Session, manifestId: string) {
  return rows<MigrationItem>(
    `migration_items?manifest_id=eq.${encodeURIComponent(manifestId)}&select=source_row_id,outcome,reason_code`,
    session,
  );
}
export function learningEvents(session: Session) {
  return rows<LearningEvent>(
    'learning_events?select=certification_id,question_id,question_revision,selected,is_correct',
    session,
  );
}
