import type { ProjectionInput, PublicTable } from '../supabase/functions/account-linking/merge/types.ts';
import { rawColumns } from '../supabase/functions/account-linking/merge/validation.ts';
import { fixtureDigest, fixtureRow } from './account-merge-preview-fixture-values.test.ts';

export const source = '11111111-1111-4111-8111-111111111111';
export const target = '22222222-2222-4222-8222-222222222222';

function snapshot(accountId: string, suffix: string) {
  const publicRows = Object.keys(rawColumns).map((table) => [
    `public.${table}`,
    [fixtureRow(table as PublicTable, accountId, suffix)],
  ]);
  const privateRows = [
    'learning_accounts',
    'learning_memberships',
    'account_merge_receipts',
    'account_merge_archives',
    'account_merge_id_maps',
  ].map((table) => [`kaq_private.${table}`, []]);
  return {
    sqlDigest: fixtureDigest(suffix),
    document: {
      algorithm_version: 1,
      accounts: [accountId],
      tables: Object.fromEntries([...publicRows, ...privateRows]),
    },
  };
}

export function goldenInput(): ProjectionInput {
  return {
    source: { accountId: source, provenance: 'source', snapshot: snapshot(source, '1') },
    target: { accountId: target, provenance: 'target', snapshot: snapshot(target, '2') },
  };
}
