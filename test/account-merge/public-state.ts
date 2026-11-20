import { createHash } from 'node:crypto';
import { sql } from './commands';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export const publicSchemaQuery = `select jsonb_build_object(
    'relations', (select jsonb_agg(jsonb_build_object(
      'name', c.relname, 'kind', c.relkind, 'acl', c.relacl, 'owner', pg_get_userbyid(c.relowner),
      'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity,
      'columns', (select jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', format_type(a.atttypid,a.atttypmod),
        'required', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
        'acl', a.attacl, 'collation', a.attcollation,
        'default', pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints', (select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname)
        from pg_constraint where conrelid=c.oid),
      'triggers', (select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,
        'definition',pg_get_triggerdef(oid)) order by tgname) from pg_trigger where tgrelid=c.oid),
      'policies', (select jsonb_agg(jsonb_build_object('name',polname,'roles',polroles,'command',polcmd,
        'permissive',polpermissive,
        'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) order by polname)
        from pg_policy where polrelid=c.oid)
    ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v','m')),
    'indexes', (select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public'),
    'functions', (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',pg_get_userbyid(p.proowner)) order by p.oid::regprocedure::text)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
    'schemaAcl', (select jsonb_build_object('acl',nspacl,'owner',pg_get_userbyid(nspowner)) from pg_namespace where nspname='public'),
    'defaultAcl', (select jsonb_agg(to_jsonb(d) order by d.defaclrole,d.defaclnamespace,d.defaclobjtype)
      from pg_default_acl d where d.defaclnamespace in (0,'public'::regnamespace::oid))
  )::text`;

export function publicState() {
  const schema = sql(publicSchemaQuery);
  const names: unknown = JSON.parse(
    sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public'"),
  );
  if (!Array.isArray(names)) throw new Error('Invalid public relation inventory');
  const tables = names.map((name: unknown) => {
    if (typeof name !== 'string' || !/^[a-z_]+$/.test(name))
      throw new Error('Unexpected public relation');
    const rows = sql(
      `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text from public.${name} t`,
    );
    const records: unknown = JSON.parse(rows);
    if (!Array.isArray(records)) throw new Error('Invalid public record snapshot');
    return { name, rows: records.length, digest: hash(rows) };
  });
  return { schemaDigest: hash(schema), tables };
}
