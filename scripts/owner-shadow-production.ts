import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataMigrations } from './data-migrations';
import { contractFingerprintSql, contractSql } from './owner-shadow-production-contract';

export const projectRef = 'vawysutvqmtxthbtflsu';
export const migrationFile = '202611220001_learning_owner_shadow.sql';
export type LedgerRow = { version: string; name: string; sourceHash: string | null };
export type Source = { body: string; source: string; sourceHash: string };

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const name = (file: string) => {
  const match = file.match(/^(\d{12})_([a-z_]+)\.sql$/);
  if (!match) throw new Error(`Invalid migration file name: ${file}`);
  return { version: match[1], name: match[2] };
};

export function expectedLedger() {
  const migrationIndex = dataMigrations.indexOf(migrationFile);
  if (migrationIndex < 0 || new Set(dataMigrations).size !== dataMigrations.length)
    throw new Error('Owner-shadow migration registry is not canonical');
  return dataMigrations.slice(0, migrationIndex + 1).map(name);
}

function expectedLedgerSql() {
  const migrationIndex = dataMigrations.indexOf(migrationFile);
  if (migrationIndex < 0) throw new Error('Owner-shadow migration is not registered');
  const rows = dataMigrations.slice(0, migrationIndex).map((file) => {
    const source = readFileSync(join('supabase/migrations', file), 'utf8');
    const { version, name: migrationName } = name(file);
    return `('${version}','${migrationName}', '${hash(source)}')`;
  });
  return rows.join(',');
}

export function readSource(root = '.'): Source {
  const source = readFileSync(join(root, 'supabase/migrations', migrationFile), 'utf8');
  const marker = 'do $owner_shadow$\n';
  const start = source.indexOf(marker);
  const finish = source.indexOf('end $owner_shadow$;', start);
  if (start < 0 || finish < start) throw new Error('Owner-shadow DO body is missing');
  const end = finish + 'end $owner_shadow$;'.length;
  const prefix =
    '-- #58の最初のshadow/backfill。公開所有者境界はまだAuth UIDのまま維持する。\nbegin;\nset transaction isolation level serializable;\n\n';
  if (source.slice(0, start) !== prefix || source.slice(end) !== '\n\ncommit;\n')
    throw new Error('Owner-shadow migration framing changed');
  return { body: source.slice(start, end), source, sourceHash: hash(source) };
}

export function ledgerState(rows: LedgerRow[], sourceHash: string) {
  const expected = expectedLedger();
  const previous = expected.slice(0, -1);
  const same = (actual: LedgerRow[], wanted: typeof expected) =>
    actual.length === wanted.length &&
    actual.every(
      (row, index) => row.version === wanted[index]?.version && row.name === wanted[index]?.name,
    );
  if (same(rows, previous)) return 'pending' as const;
  if (same(rows, expected) && rows.at(-1)?.sourceHash === sourceHash) return 'applied' as const;
  throw new Error('Production migration ledger differs from the canonical source');
}

export function preflightQuery() {
  const tables = [
    ['auth', 'users'],
    ['auth', 'sessions'],
    ['auth', 'mfa_amr_claims'],
    ['public', 'learning_state'],
    ['kaq_private', 'learning_accounts'],
    ['kaq_private', 'learning_memberships'],
    ['kaq_private', 'learning_session_grants'],
    ['supabase_migrations', 'schema_migrations'],
  ];
  const values = tables.map(([schema, table]) => `('${schema}','${table}')`).join(',');
  return `with ${contractSql()}, tables(schema_name,table_name) as (values ${values}), privileges as (
    select jsonb_object_agg(schema_name||'.'||table_name,jsonb_build_object(
      'select',has_table_privilege(current_user,format('%I.%I',schema_name,table_name),'SELECT'),
      'update',has_table_privilege(current_user,format('%I.%I',schema_name,table_name),'UPDATE'),
      'insert',has_table_privilege(current_user,format('%I.%I',schema_name,table_name),'INSERT')) order by schema_name,table_name) value from tables
  ), ledger as (
    select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
      'sourceHash',case when statements is null then null else encode(extensions.digest(array_to_string(statements,E'\\n'),'sha256'),'hex') end) order by version),'[]'::jsonb) value
    from supabase_migrations.schema_migrations
  ), contract as (
    select jsonb_build_object('ownerTables',(select value from owner_contract),'privateTables',(select value from private_contract),
      'policies',(select value from policy_contract),'functions',(select value from function_contract)) value
  ) select jsonb_build_object('role',jsonb_build_object('currentUser',current_user,'sessionUser',session_user,
    'superuser',(select rolsuper from pg_roles where rolname=current_user),'bypassRls',(select rolbypassrls from pg_roles where rolname=current_user),
    'inherit',(select rolinherit from pg_roles where rolname=current_user),'createDb',(select rolcreatedb from pg_roles where rolname=current_user),
    'createRole',(select rolcreaterole from pg_roles where rolname=current_user)),
    'ledger',(select value from ledger),'privileges',(select value from privileges),'contract',(select value from contract),
    'contractFingerprint',encode(extensions.digest((select value::text from contract),'sha256'),'hex'),
    'transaction',jsonb_build_object('isolation',current_setting('transaction_isolation'),'readOnly',current_setting('transaction_read_only'))) as result;`;
}

export function readOnlyPreflightFrame() {
  return `begin;
set transaction isolation level serializable read only;
${preflightQuery()}
rollback;
`;
}

export function migrationFrame(source: Source, expectedContractHash: string) {
  const tag = '$owner_shadow_ledger$';
  if (source.source.includes(tag))
    throw new Error('Owner-shadow source conflicts with ledger delimiter');
  if (!/^[a-f0-9]{64}$/.test(expectedContractHash)) throw new Error('Contract fingerprint is invalid');
  const { version, name: migrationName } = name(migrationFile);
  return `begin;
set transaction isolation level serializable;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $owner_shadow_ledger_guard$
begin
  if coalesce((select jsonb_agg(jsonb_build_object('version',version,'name',name,'sourceHash',case when statements is null then null else encode(extensions.digest(array_to_string(statements,E'\\n'),'sha256'),'hex') end) order by version) from supabase_migrations.schema_migrations),'[]'::jsonb) <>
     (select jsonb_agg(jsonb_build_object('version',version,'name',name,'sourceHash',source_hash) order by version) from (values ${expectedLedgerSql()}) as expected(version,name,source_hash)) then
    raise exception using errcode='PT409',message='KAQ_OWNER_SHADOW_LEDGER_DRIFT';
  end if;
end $owner_shadow_ledger_guard$;
do $owner_shadow_contract$
begin
  if (${contractFingerprintSql()}) <> '${expectedContractHash}' then
    raise exception using errcode='PT409',message='KAQ_OWNER_SHADOW_CONTRACT_DRIFT';
  end if;
end $owner_shadow_contract$;
${source.body}
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('${version}','${migrationName}',array[${tag}${source.source}${tag}]);
do $owner_shadow_postcondition$
begin
  if exists (select 1 from kaq_private.learning_memberships member join kaq_private.learning_accounts account on account.id=member.account_id
    where member.account_id<>member.auth_user_id or member.epoch<>0 or member.status<>'active' or member.session_fence_at is not null
      or account.status<>'active' or account.membership_revision<>0 or account.session_fence_at is not null)
  then raise exception using errcode='PT400',message='KAQ_OWNER_SHADOW_POSTCONDITION'; end if;
end $owner_shadow_postcondition$;
commit;
`;
}

export function rows(value: unknown): LedgerRow[] {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== 'object'))
    throw new Error('Management query returned no ledger rows');
  return value.map((row) => {
    const item = row as Record<string, unknown>;
    if (typeof item.version !== 'string' || typeof item.name !== 'string')
      throw new Error('Invalid ledger row');
    return {
      version: item.version,
      name: item.name,
      sourceHash: typeof item.sourceHash === 'string' ? item.sourceHash : null,
    };
  });
}
