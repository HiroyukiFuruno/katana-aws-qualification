import type { RealSession } from './sessions';
import { fixtureKey, gatewayOrigin } from './settings';

type RequestOptions = { body?: object; method?: string; service?: boolean; token?: string };

async function request(
  path: string,
  { body, method = 'GET', service = false, token }: RequestOptions = {},
) {
  const key = fixtureKey(service ? 'service_role' : 'anon');
  return fetch(`${gatewayOrigin}/rest/v1${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      apikey: key,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token || service ? { Authorization: `Bearer ${token ?? key}` } : {}),
    },
    method,
  });
}

async function rows<T>(path: string, token?: string, service = false) {
  const response = await request(path, { service, token });
  if (!response.ok)
    throw new Error(`PostgREST read failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T[];
}

export function learningEvents(session: RealSession) {
  return rows<{ event_id: string }>('/learning_events?select=event_id', session.accessToken);
}

export function profileRows(session: RealSession) {
  return rows<{ revision: number }>('/roadmap_profiles?select=revision', session.accessToken);
}

export function examSessions(session: RealSession) {
  return rows<{ exam_id: string; state: 'draft' | 'submitted' }>(
    '/exam_sessions?select=exam_id,state',
    session.accessToken,
  );
}

export function serviceRows(table: string, userId: string) {
  return rows(`${table}?user_id=eq.${encodeURIComponent(userId)}&select=user_id`, undefined, true);
}

export async function replayRpc(path: string, token: string, body: object) {
  const response = await request(path, { body, method: 'POST', token });
  if (!response.ok)
    throw new Error(`PostgREST RPC retry failed: ${response.status} ${await response.text()}`);
  return response;
}
