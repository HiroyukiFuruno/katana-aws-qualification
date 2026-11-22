import { sql } from './commands';

const privateRelations = [
  'learning_accounts',
  'learning_memberships',
  'learning_session_grants',
  'account_intents',
  'account_merge_receipts',
  'account_merge_archives',
  'account_merge_id_maps',
  'account_merge_resolution_choices',
  'account_merge_deferred_rows',
  'account_merge_resume_heads',
  'account_merge_replay_heads',
  'account_merge_lineage_closure',
] as const;

export function privateState() {
  const tables = privateRelations
    .map(
      (relation) =>
        `'${relation}', (select jsonb_build_object('count', count(*), 'digest', encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text)::text, '[]'), 'sha256'), 'hex')) from kaq_private.${relation} row)`,
    )
    .join(',\n    ');
  return sql(`select jsonb_build_object(
    'tables', jsonb_build_object(${tables}),
    'catalog', (select jsonb_build_object('count', count(*), 'digest', encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(catalog) order by to_jsonb(catalog)::text)::text, '[]'), 'sha256'), 'hex')) from public.published_fundamentals_catalogs catalog)
  )`);
}
