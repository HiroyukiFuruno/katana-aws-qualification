import { sql } from './sql';

type Audit = { id: string; digest: string; actor: string | null; action: string | null };

function isAudit(row: unknown): row is Audit {
  if (!row || typeof row !== 'object') return false;
  const item = row as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.digest === 'string' &&
    /^[0-9a-f]{64}$/.test(item.digest) &&
    (item.actor === null || typeof item.actor === 'string') &&
    (item.action === null || typeof item.action === 'string')
  );
}

export function auditSnapshot(): Audit[] {
  const value: unknown = JSON.parse(
    sql(
      "select coalesce(jsonb_agg(jsonb_build_object('id',id,'digest',encode(extensions.digest(to_jsonb(a)::text,'sha256'),'hex'),'actor',payload->>'actor_id','action',payload->>'action') order by id),'[]'::jsonb) from auth.audit_log_entries a;",
    ),
  );
  if (!Array.isArray(value) || !value.every(isAudit)) throw new Error('Invalid SDK audit snapshot');
  return value;
}

export function verifyAudit(baseline: Audit[], ownedUsers: string[]) {
  const current = auditSnapshot();
  const old = new Map(baseline.map((row) => [row.id, row.digest]));
  const after = new Map(current.map((row) => [row.id, row.digest]));
  if (baseline.some((row) => after.get(row.id) !== row.digest))
    throw new Error('SDK modified an existing GoTrue audit row');
  const added = current.filter((row) => !old.has(row.id));
  if (added.some((row) => !row.actor || !ownedUsers.includes(row.actor)))
    throw new Error('Unexpected GoTrue audit actor during SDK verification');
  return {
    existingRowsUnchanged: true,
    newRows: added.length,
    actors: [...new Set(added.map((row) => row.actor))].sort(),
    actions: [...new Set(added.map((row) => row.action))].sort(),
  };
}
