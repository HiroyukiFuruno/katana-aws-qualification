export type DeleteAccountEnvironment = {
  authUrl: string;
  serviceRoleKey: string;
  allowedOrigin: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Verification = { userId: string } | { userId: null; upstream: boolean };

function response(status: number, origin: string, body?: object) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  });
  if (!body) return new Response(null, { status, headers });
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function bearer(request: Request) {
  const value = request.headers.get('authorization');
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function verifiedUserId(
  token: string,
  environment: DeleteAccountEnvironment,
  fetcher: Fetcher,
): Promise<Verification> {
  try {
    const result = await fetcher(new URL('/auth/v1/user', environment.authUrl), {
      headers: { apikey: environment.serviceRoleKey, Authorization: `Bearer ${token}` },
    });
    if (result.status >= 500) return { userId: null, upstream: true };
    if (!result.ok) return { userId: null, upstream: false };
    const value: unknown = await result.json().catch(() => null);
    return isRecord(value) && typeof value.id === 'string'
      ? { userId: value.id }
      : { userId: null, upstream: true };
  } catch {
    return { userId: null, upstream: true };
  }
}

export async function deleteAccount(
  request: Request,
  environment: DeleteAccountEnvironment,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!origin || origin !== environment.allowedOrigin) return new Response(null, { status: 403 });
  if (request.method === 'OPTIONS') return response(204, origin);
  if (request.method !== 'POST') return response(405, origin, { error: 'method_not_allowed' });
  if ((await request.text()).length !== 0) return response(400, origin, { error: 'invalid_request' });
  const token = bearer(request);
  if (!token) return response(401, origin, { error: 'unauthorized' });
  const verified = await verifiedUserId(token, environment, fetcher);
  if (!verified.userId) {
    const upstream = 'upstream' in verified && verified.upstream;
    return response(upstream ? 502 : 401, origin, {
      error: upstream ? 'upstream_unavailable' : 'unauthorized',
    });
  }
  const headers = {
    apikey: environment.serviceRoleKey,
    Authorization: `Bearer ${environment.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  try {
    const deletion = await fetcher(
      new URL(`/auth/v1/admin/users/${encodeURIComponent(verified.userId)}`, environment.authUrl),
      { method: 'DELETE', headers, body: JSON.stringify({ should_soft_delete: false }) },
    );
    if (!deletion.ok) return response(502, origin, { error: 'deletion_failed' });
    const confirmation = await fetcher(
      new URL(`/auth/v1/admin/users/${encodeURIComponent(verified.userId)}`, environment.authUrl),
      { headers },
    );
    return confirmation.status === 404
      ? response(204, origin)
      : response(502, origin, { error: 'deletion_failed' });
  } catch {
    return response(502, origin, { error: 'upstream_unavailable' });
  }
}
