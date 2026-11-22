import { spawnSync } from 'node:child_process';
import { compose } from '../account-merge/settings';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type Actor = { userId: string; sessionId: string; expiresAt: number };

export function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function requiredUuid(value: string): string {
  if (!uuid.test(value)) throw new Error('invalid fixture identifier');
  return value;
}

export function sql(statement: string): string {
  const result = spawnSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'database',
      'psql',
      '-q',
      '-XAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'supabase_auth_admin',
      '-d',
      'kaq_account_merge',
    ],
    { encoding: 'utf8', input: statement },
  );
  if (result.error || result.status !== 0) throw new Error('SDK fixture database operation failed');
  return result.stdout.trim();
}

export function json<T>(statement: string): T {
  const value = sql(statement);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error('invalid SDK fixture database response');
  }
}

export function actorStatement(actor: Actor, statement: string): string {
  requiredUuid(actor.userId);
  requiredUuid(actor.sessionId);
  if (!Number.isSafeInteger(actor.expiresAt)) throw new Error('invalid fixture session expiry');
  const claims = JSON.stringify({
    sub: actor.userId,
    session_id: actor.sessionId,
    role: 'authenticated',
    aud: 'authenticated',
    exp: actor.expiresAt,
  });
  return `begin;
set local request.jwt.claims = ${literal(claims)};
${statement}
commit;`;
}

export function actorSql(actor: Actor, statement: string): string {
  return sql(actorStatement(actor, statement));
}

export function actorJson<T>(actor: Actor, statement: string): T {
  const value = actorSql(actor, statement)
    .split('\n')
    .find((line) => line.startsWith('{'));
  if (!value) throw new Error('invalid SDK fixture actor response');
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error('invalid SDK fixture actor response');
  }
}
