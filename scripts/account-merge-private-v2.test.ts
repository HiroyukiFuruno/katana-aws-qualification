import { expect, test } from 'bun:test';
import {
  privateV2Tables,
  validatePrivateV2,
} from '../supabase/functions/account-linking/merge/validation-private-v2.ts';
import { account, origin, privateV2Document } from './account-merge-private-v2-fixture.ts';

test('accepts every DDL-backed private v2 row including text unit identifiers', () => {
  const candidate = privateV2Document();
  expect(Object.keys(candidate.tables).sort()).toEqual(privateV2Tables);
  validatePrivateV2(candidate, account);
});

test('rejects unknown columns, invalid UUIDs, NULL typed values, and enum changes', () => {
  const cases = [
    (value: ReturnType<typeof privateV2Document>) => {
      value.tables['kaq_private.learning_accounts'][0].unknown = true;
    },
    (value: ReturnType<typeof privateV2Document>) => {
      value.tables['kaq_private.account_merge_receipts'][0].id = 'not-a-uuid';
    },
    (value: ReturnType<typeof privateV2Document>) => {
      value.tables['kaq_private.learning_memberships'][0].epoch = null;
    },
    (value: ReturnType<typeof privateV2Document>) => {
      value.tables['kaq_private.account_merge_archives'][0].table_name = 'unknown';
    },
  ];
  for (const mutate of cases) {
    const candidate = privateV2Document();
    mutate(candidate);
    expect(() => validatePrivateV2(candidate, account)).toThrow();
  }
});

test('rejects zero, duplicate, unsorted, or empty account lineage', () => {
  const cases = [
    ['00000000-0000-0000-0000-000000000000', account],
    [origin, origin],
    [account, origin],
    [],
  ];
  for (const lineage_accounts of cases) {
    const candidate = privateV2Document();
    candidate.lineage_accounts = lineage_accounts;
    expect(() => validatePrivateV2(candidate, account)).toThrow();
  }
});
