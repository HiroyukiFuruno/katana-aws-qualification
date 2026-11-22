import { expect, test } from 'bun:test';
import {
  expectedLedger,
  ledgerState,
  migrationFrame,
  readOnlyPreflightFrame,
  readSource,
} from './owner-shadow-production';
import { contract, contractMatches, contractSql } from './owner-shadow-production-contract';

test('accepts only the 14-row prefix plus owner migration or the same source-hash replay', () => {
  const expected = expectedLedger();
  const source = readSource();
  expect(
    ledgerState(
      expected.slice(0, -1).map((row) => ({ ...row, sourceHash: null })),
      source.sourceHash,
    ),
  ).toBe('pending');
  expect(
    ledgerState(
      expected.map((row, index) => ({
        ...row,
        sourceHash: index + 1 === expected.length ? source.sourceHash : null,
      })),
      source.sourceHash,
    ),
  ).toBe('applied');
  expect(() =>
    ledgerState(
      [
        ...expected.slice(0, -1),
        { version: '202611220001', name: 'other', sourceHash: source.sourceHash },
      ],
      source.sourceHash,
    ),
  ).toThrow();
});

test('frames the unmodified DO body and records exactly the registered migration', () => {
  const source = readSource();
  const frame = migrationFrame(source, '0'.repeat(64));
  expect(expectedLedger().at(-1)?.version).toBe('202611220001');
  expect(frame).toStartWith('begin;\nset transaction isolation level serializable;\n');
  expect(frame).toContain(
    'lock table supabase_migrations.schema_migrations in share row exclusive mode;',
  );
  expect(frame).toContain('KAQ_OWNER_SHADOW_LEDGER_DRIFT');
  expect(frame).toContain(source.body);
  expect(frame).toContain('KAQ_OWNER_SHADOW_CONTRACT_DRIFT');
  expect(frame).toContain('insert into supabase_migrations.schema_migrations(version,name,statements)');
  expect(frame).toEndWith('end $owner_shadow_postcondition$;\ncommit;\n');
});

test('runs metadata preflight in one serializable read-only transaction', () => {
  expect(readOnlyPreflightFrame()).toStartWith(
    'begin;\nset transaction isolation level serializable read only;\n',
  );
  expect(readOnlyPreflightFrame()).toEndWith('rollback;\n');
  expect(readOnlyPreflightFrame()).toContain("'schema_migrations'");
  expect(readOnlyPreflightFrame()).toContain("'INSERT')) order by schema_name,table_name)");
});

test('pins all owner, policy, private-table, and public-function inventory names', () => {
  const expected = contract();
  const firstPolicy = expected.policies[0];
  if (!firstPolicy) throw new Error('Expected policy inventory is empty');
  expect(expected.ownerTables).toHaveLength(12);
  expect(expected.policies).toHaveLength(10);
  expect(expected.privateTables).toHaveLength(10);
  expect(expected.functions).toHaveLength(44);
  expect(
    contractMatches(
      {
        ownerTables: expected.ownerTables.map((name) => ({ name })),
        privateTables: expected.privateTables.map((name) => ({ name })),
        functions: expected.functions.map((signature) => ({ signature })),
        policies: expected.policies,
      },
      expected,
    ),
  ).toBe(true);
  expect(
    contractMatches(
      {
        ownerTables: expected.ownerTables.map((name) => ({ name })),
        privateTables: expected.privateTables.map((name) => ({ name })),
        functions: expected.functions.map((signature) => ({ signature })),
        policies: [{ table: firstPolicy.table, name: 'wrong' }],
      },
      expected,
    ),
  ).toBe(false);
  expect(
    contractMatches(
      {
        ownerTables: expected.ownerTables.map((name) => ({ name })),
        privateTables: expected.privateTables.map((name) => ({ name })),
        functions: expected.functions.map((signature) => ({ signature })),
        policies: [...expected.policies, { table: firstPolicy.table, name: 'extra_policy' }],
      },
      expected,
    ),
  ).toBe(false);
});

test('resolves source signatures through PostgreSQL and rejects unlisted public functions', () => {
  const expected = contract();
  const sql = contractSql();
  expect(sql).toContain("to_regprocedure('public.'||e.signature)");
  expect(sql).toContain("'signature',coalesce(e.signature,p.oid::regprocedure::text)");
  expect(sql).toContain('left join resolved_function e on e.oid=p.oid');
  expect(sql).toContain("'pg_proc'::regclass");
  expect(sql).toContain("from pg_policies p where p.schemaname='public'");
  expect(sql).toContain("'constraints'");
  expect(
    contractMatches(
      {
        ownerTables: expected.ownerTables.map((name) => ({ name })),
        privateTables: expected.privateTables.map((name) => ({ name })),
        functions: [...expected.functions, 'unlisted_public_function()'].map((signature) => ({
          signature,
        })),
        policies: expected.policies,
      },
      expected,
    ),
  ).toBe(false);
});
