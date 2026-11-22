import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from '../test/account-merge/commands';
import { dataMigrations } from './data-migrations';
import type { migrationFrame } from './owner-shadow-production';
import { contract } from './owner-shadow-production-contract';

type ApplySource = Parameters<typeof migrationFrame>[0];

function sourceStatement(file: string, index: number) {
  const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
  const tag = `$owner_shadow_ledger_${index}$`;
  if (source.includes(tag)) throw new Error('Canonical migration delimiter collision');
  return `('${file.slice(0, 12)}','${file.slice(13, -4)}',array[${tag}${source}${tag}])`;
}

export function seedCanonicalLedger() {
  const prior = dataMigrations.slice(
    0,
    dataMigrations.indexOf('202611220001_learning_owner_shadow.sql'),
  );
  sql(
    `insert into supabase_migrations.schema_migrations(version,name,statements) values ${prior.map(sourceStatement).join(',')};`,
  );
}

export function verifyReviewRejections(
  source: ApplySource,
  fingerprint: string,
  preflight: () => { state: 'pending' | 'applied' },
  apply: (source: ApplySource, fingerprint: string) => void,
) {
  const policyTable = contract().ownerTables[0];
  assert(policyTable);
  sql(`create policy owner_shadow_ops_extra on public.${policyTable} using (true);`);
  try {
    assert.throws(() => preflight(), /Preflight contract inventory differs from source/);
    assert.throws(
      () => apply(source, fingerprint),
      /ERROR:\s+PT409:\s+KAQ_OWNER_SHADOW_CONTRACT_DRIFT/s,
    );
  } finally {
    sql(`drop policy owner_shadow_ops_extra on public.${policyTable};`);
  }
  assert.equal(preflight().state, 'pending');
  sql(
    "insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611220002','unexpected_future',array['unexpected future ledger row']);",
  );
  try {
    assert.throws(() => apply(source, fingerprint), /ERROR:\s+PT409:\s+KAQ_OWNER_SHADOW_LEDGER_DRIFT/s);
  } finally {
    sql("delete from supabase_migrations.schema_migrations where version='202611220002';");
  }
  assert.equal(preflight().state, 'pending');
}
