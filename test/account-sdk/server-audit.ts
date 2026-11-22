import { sql } from './sql';

export type Audit = {
  id: string;
  digest: string;
  actor: string | null;
  action: string | null;
  target: string | null;
};

function isAudit(row: unknown): row is Audit {
  if (!row || typeof row !== 'object') return false;
  const item = row as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.digest === 'string' &&
    /^[0-9a-f]{64}$/.test(item.digest) &&
    (item.actor === null || typeof item.actor === 'string') &&
    (item.action === null || typeof item.action === 'string') &&
    (item.target === null || typeof item.target === 'string')
  );
}

export function auditSnapshot(): Audit[] {
  const value: unknown = JSON.parse(
    sql(
      "select coalesce(jsonb_agg(jsonb_build_object('id',id,'digest',encode(extensions.digest(to_jsonb(a)::text,'sha256'),'hex'),'actor',payload->>'actor_id','action',payload->>'action','target',payload->'traits'->>'user_id') order by id),'[]'::jsonb) from auth.audit_log_entries a;",
    ),
  );
  if (!Array.isArray(value) || !value.every(isAudit)) throw new Error('Invalid SDK audit snapshot');
  return value;
}

export function validateAuditDelta(
  baseline: Audit[],
  current: Audit[],
  ownedUsers: string[],
  aliases: string[],
) {
  const old = new Map(baseline.map((row) => [row.id, row.digest]));
  const after = new Map(current.map((row) => [row.id, row.digest]));
  if (baseline.some((row) => after.get(row.id) !== row.digest))
    throw new Error('SDK modified an existing GoTrue audit row');
  const added = current.filter((row) => !old.has(row.id));
  const admin = added.filter((row) => row.actor === '00000000-0000-0000-0000-000000000000');
  const valid = (row: Audit) =>
    (row.actor !== null &&
      ownedUsers.includes(row.actor) &&
      (row.action === 'login' || row.action === 'user_signedup') &&
      (row.target === null || row.target === row.actor)) ||
    (admin.includes(row) &&
      row.target !== null &&
      aliases.includes(row.target) &&
      (row.action === 'user_signedup' || row.action === 'user_deleted'));
  if (added.some((row) => !valid(row)))
    throw new Error('Unexpected GoTrue audit actor during SDK verification');
  for (const alias of aliases) {
    const actions = admin
      .filter((row) => row.target === alias)
      .map((row) => row.action)
      .sort();
    if (JSON.stringify(actions) !== JSON.stringify(['user_deleted', 'user_signedup']))
      throw new Error('Owner alias audit must contain exactly one creation and one deletion');
  }
  return {
    existingRowsUnchanged: true,
    newRows: added.length,
    actors: [...new Set(added.map((row) => row.actor))].sort(),
    actions: [...new Set(added.map((row) => row.action))].sort(),
    adminAliasRows: admin.length,
    ownedAliases: [...aliases].sort(),
  };
}

export function verifyAudit(baseline: Audit[], ownedUsers: string[], aliases: string[] = []) {
  return validateAuditDelta(baseline, auditSnapshot(), ownedUsers, aliases);
}
