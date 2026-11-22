import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Manifest = {
  functions: { signature: string }[];
  ownerTables: { name: string }[];
  rlsPolicies: { name: string; table: string }[];
};
export type Contract = {
  functions: string[];
  ownerTables: string[];
  privateTables: string[];
  policies: { name: string; table: string }[];
};
const privateTables = [
  'account_intents',
  'account_merge_archives',
  'account_merge_id_maps',
  'account_merge_receipts',
  'account_proof_legs',
  'account_proof_runtime',
  'account_proofs',
  'learning_accounts',
  'learning_memberships',
  'learning_session_grants',
];
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function contract(root = '.'): Contract {
  const value = JSON.parse(
    readFileSync(join(root, 'scripts/account-owner-cutover-manifest.json'), 'utf8'),
  ) as Manifest;
  const functions = value.functions.map((entry) => entry.signature).sort();
  const ownerTables = value.ownerTables.map((entry) => entry.name).sort();
  const policies = value.rlsPolicies
    .map(({ name, table }) => ({ name, table }))
    .sort((a, b) => `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`));
  if (functions.length !== 44 || ownerTables.length !== 12 || policies.length !== 10)
    throw new Error('Owner cutover manifest inventory is incomplete');
  if (
    [...functions, ...ownerTables, ...privateTables, ...policies.flatMap(Object.values)].some(
      (item) => !/^[a-z0-9_(), \u005B\u005D]+$/.test(item),
    )
  )
    throw new Error('Owner cutover manifest contains an unsafe SQL identifier');
  return { functions, ownerTables, privateTables: [...privateTables], policies };
}

export function contractSql(root = '.') {
  const input = contract(root);
  const values = (items: string[]) => items.map((item) => `(${literal(item)})`).join(',');
  const policies = input.policies
    .map((item) => `(${literal(item.table)},${literal(item.name)})`)
    .join(',');
  return `expected_owner(name) as (values ${values(input.ownerTables)}),
expected_private(name) as (values ${values(input.privateTables)}),
expected_policy(table_name,name) as (values ${policies}),
expected_function(signature) as (values ${values(input.functions)}),
resolved_function(signature,oid) as (select e.signature,to_regprocedure('public.'||e.signature)::oid from expected_function e),
owner_contract as (select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
  'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',not a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(jsonb_build_object('name',x.conname,'definition',pg_get_constraintdef(x.oid),'validated',x.convalidated) order by x.conname) from pg_constraint x where x.conrelid=c.oid)) order by c.relname),'[]'::jsonb) value
  from expected_owner e join pg_class c on c.relname=e.name join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'),
private_contract as (select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
  'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',not a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(jsonb_build_object('name',x.conname,'definition',pg_get_constraintdef(x.oid),'validated',x.convalidated) order by x.conname) from pg_constraint x where x.conrelid=c.oid)) order by c.relname),'[]'::jsonb) value
  from expected_private e join pg_class c on c.relname=e.name join pg_namespace n on n.oid=c.relnamespace and n.nspname='kaq_private'),
policy_contract as (select coalesce(jsonb_agg(jsonb_build_object('table',p.tablename,'name',p.policyname,'roles',p.roles,'command',p.cmd,'qual',p.qual,'check',p.with_check) order by p.tablename,p.policyname),'[]'::jsonb) value
  from expected_policy e join pg_policies p on p.schemaname='public' and p.tablename=e.table_name and p.policyname=e.name),
function_contract as (select coalesce(jsonb_agg(jsonb_build_object('signature',coalesce(e.signature,p.oid::regprocedure::text),'owner',pg_get_userbyid(p.proowner),
  'bodyHash',encode(extensions.digest(p.prosrc,'sha256'),'hex'),'securityDefiner',p.prosecdef,'searchPath',coalesce(array_to_string(p.proconfig,E'\\n'),''),
  'execute',jsonb_build_object('anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'))) order by coalesce(e.signature,p.oid::regprocedure::text)),'[]'::jsonb) value
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
  left join resolved_function e on e.oid=p.oid
  where not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))`;
}

export function contractFingerprintSql(root = '.') {
  return `with ${contractSql(root)}, contract as (
    select jsonb_build_object('ownerTables',(select value from owner_contract),'privateTables',(select value from private_contract),
      'policies',(select value from policy_contract),'functions',(select value from function_contract)) value
  ) select encode(extensions.digest((select value::text from contract),'sha256'),'hex')`;
}

export function contractMatches(value: unknown, expected: Contract) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const names = (key: string, name: string) =>
    Array.isArray(item[key]) &&
    (item[key] as unknown[])
      .map((entry) =>
        entry && typeof entry === 'object' ? (entry as Record<string, unknown>)[name] : null,
      )
      .sort()
      .join('|');
  const policyNames =
    Array.isArray(item.policies) &&
    (item.policies as unknown[])
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const policy = entry as Record<string, unknown>;
        return typeof policy.table === 'string' && typeof policy.name === 'string'
          ? `${policy.table}.${policy.name}`
          : null;
      })
      .sort()
      .join('|');
  return (
    names('ownerTables', 'name') === expected.ownerTables.join('|') &&
    names('privateTables', 'name') === expected.privateTables.join('|') &&
    names('functions', 'signature') === expected.functions.join('|') &&
    policyNames === expected.policies.map((policy) => `${policy.table}.${policy.name}`).join('|')
  );
}
