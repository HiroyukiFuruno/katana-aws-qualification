import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AuthClient } from '@supabase/auth-js';
import { gatewayOrigin, testKey } from '../account-merge/settings';
import { type Actor, literal, requiredUuid, sql } from './sql';

export type Body = { side?: unknown; legId?: unknown; code?: unknown };

export function trackedServer(
  handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>,
) {
  const pending = new Set<Promise<void>>();
  let failed = false;
  const server = createServer((request, response) => {
    const task = handler(request, response);
    pending.add(task);
    void task.then(
      () => pending.delete(task),
      () => {
        failed = true;
        pending.delete(task);
        response.destroy();
      },
    );
  });
  return {
    server,
    async drain() {
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await Promise.allSettled([...pending]);
      await closed;
      if (failed) throw new Error('SDK request failed before fixture cleanup');
    },
  };
}

export async function listen(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.listen(54534, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve())),
  );
}

export function send(response: ServerResponse, status: number, value: object) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:54533',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(value));
}

export async function body(request: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  for await (const part of request) chunks.push(Buffer.from(part));
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid request');
  return value as Body;
}

function token(request: IncomingMessage) {
  const value = request.headers.authorization;
  if (typeof value !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/.test(value))
    throw new Error('invalid bearer');
  return value.slice('Bearer '.length);
}

export async function actor(request: IncomingMessage): Promise<Actor> {
  const bearer = token(request);
  const auth = new AuthClient({
    url: `${gatewayOrigin}/auth/v1`,
    headers: { apikey: testKey() },
    persistSession: false,
    autoRefreshToken: false,
  });
  const verified = await auth.getUser(bearer);
  if (verified.error || !verified.data.user?.id) throw new Error('invalid bearer');
  const part = bearer.split('.')[1];
  if (!part) throw new Error('invalid bearer');
  const claims: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  if (!claims || typeof claims !== 'object') throw new Error('invalid bearer');
  const item = claims as Record<string, unknown>;
  if (
    item.sub !== verified.data.user.id ||
    typeof item.session_id !== 'string' ||
    !Number.isSafeInteger(item.exp)
  )
    throw new Error('invalid bearer');
  requiredUuid(item.session_id);
  if (
    sql(
      `select exists(select 1 from auth.sessions where id=${literal(item.session_id)}::uuid and user_id=${literal(item.sub)}::uuid and (not_after is null or not_after > clock_timestamp()));`,
    ) !== 't'
  )
    throw new Error('invalid bearer');
  return { userId: item.sub, sessionId: item.session_id, expiresAt: item.exp as number };
}
