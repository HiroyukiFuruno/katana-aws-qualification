import { createHmac, randomUUID } from 'node:crypto';

const authUrl = 'http://127.0.0.1:54430';
const restUrl = 'http://127.0.0.1:54431';
const jwtSecret = 'kaq-data-integration-jwt-secret-not-for-production';

type AuthSession = { access_token: string; user: { id: string } };
type SignUpResponse = { access_token?: string; user?: { id: string }; session?: AuthSession };
type RequestOptions = { token?: string; method?: string; body?: object };

function apiKey() {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ role: 'anon', aud: 'authenticated', exp: 4_102_444_800 }));
  return `${header}.${payload}.${createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
}

async function request(path: string, options: RequestOptions = {}) {
  return fetch(`${restUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: apiKey(),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export async function waitForRest() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await request('/')).ok) return;
    } catch {
      // 起動中は接続拒否になる。health状態が変わるまでだけ再試行する。
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('PostgREST did not become ready');
}

async function signUp(label: string): Promise<AuthSession> {
  const response = await fetch(`${authUrl}/signup`, {
    method: 'POST',
    headers: { apikey: apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${label}-${randomUUID()}@example.test`,
      password: 'integration-password-123',
    }),
  });
  if (!response.ok) throw new Error(`GoTrue signup failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as SignUpResponse;
  if (body.access_token && body.user) return { access_token: body.access_token, user: body.user };
  if (body.session) return body.session;
  throw new Error('GoTrue signup response did not contain a session');
}

export function createSessions() {
  return Promise.all([signUp('data-user-a'), signUp('data-user-b')]);
}

function event(eventId: string) {
  return {
    event_id: eventId,
    schema_version: 1,
    certification_id: 'saa-c03',
    question_id: 'http-event',
    question_revision: 1,
    source_version: '2026-11',
    category: 'security',
    mode: 'study',
    answered_at: '2026-01-01T15:00:00Z',
    selected: ['A'],
    correct: ['A'],
    is_correct: true,
    duration_ms: 10,
    attempt_number: 1,
    prior_incorrect_count: 0,
    reward: 1,
  };
}

export async function verifyPostgrest(first: AuthSession, second: AuthSession) {
  const id = '40000000-0000-0000-0000-000000000001';
  const state = await request('/rpc/initialize_learning_state', {
    method: 'POST',
    token: first.access_token,
    body: {},
  });
  if (!state.ok)
    throw new Error(`PostgREST state initialization failed: ${state.status} ${await state.text()}`);
  const write = await request('/rpc/append_learning_event', {
    method: 'POST',
    token: first.access_token,
    body: { p_event: event(id), p_expected_generation: 0 },
  });
  if (!write.ok) throw new Error(`PostgREST RPC write failed: ${write.status} ${await write.text()}`);
  const retry = await request('/rpc/append_learning_event', {
    method: 'POST',
    token: first.access_token,
    body: { p_event: event(id), p_expected_generation: 0 },
  });
  if (!retry.ok) throw new Error(`PostgREST RPC retry failed: ${retry.status} ${await retry.text()}`);
  const otherRead = await request(`/learning_events?event_id=eq.${id}`, { token: second.access_token });
  if (!otherRead.ok || (await otherRead.text()) !== '[]')
    throw new Error('PostgREST leaked another user event');
  const directWrite = await request('/learning_events', {
    method: 'POST',
    token: first.access_token,
    body: { user_id: first.user.id, event_id: randomUUID() },
  });
  if (directWrite.ok) throw new Error('PostgREST allowed direct table write');
  const anonymousWrite = await request('/rpc/append_learning_event', {
    method: 'POST',
    body: { p_event: event(randomUUID()), p_expected_generation: 0 },
  });
  if (anonymousWrite.ok) throw new Error('PostgREST allowed anonymous RPC write');
}
