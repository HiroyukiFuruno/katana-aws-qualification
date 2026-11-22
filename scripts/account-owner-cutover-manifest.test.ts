import { expect, test } from 'bun:test';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCompleteManifest, auditOwnerCutoverManifest } from './account-owner-cutover-manifest.ts';
import { readRegistry } from './account-owner-cutover-registry.ts';
import { readSourceAudit } from './account-owner-cutover-source.ts';

const root = new URL('..', import.meta.url).pathname;

async function sourceCopy() {
  const copy = await mkdtemp(join(tmpdir(), 'owner-cutover-manifest-'));
  await Promise.all([
    cp(join(root, 'src'), join(copy, 'src'), { recursive: true }),
    cp(join(root, 'supabase'), join(copy, 'supabase'), { recursive: true }),
  ]);
  return copy;
}

test('classifies every owner-cutover source and transport surface exactly once', async () => {
  const audit = await auditOwnerCutoverManifest(root);
  expect(audit.definitionCount).toBe(49);
  expect(audit.functionCount).toBe(44);
  expect(audit.functions.every((entry) => entry.classification?.length)).toBe(true);
  expect(
    audit.functions.filter((entry) => entry.classification?.includes('owner-bound')).length,
  ).toBeGreaterThan(0);
  expect(audit.ownerTableCount).toBe(12);
  expect(audit.rlsPolicyCount).toBe(10);
  expect(audit.transportCount).toBe(26);
  expect(audit.transportNameCount).toBe(25);
});

test('rejects future public functions and transports until the manifest classifies them', async () => {
  const audit = await auditOwnerCutoverManifest(root);
  const registry = await readRegistry(root);
  expect(() =>
    assertCompleteManifest(registry, {
      ...audit,
      functions: [
        ...audit.functions,
        { signature: 'future_owner_write(uuid)', roles: ['public'], source: 'fixture' },
      ],
    }),
  ).toThrow('unclassified function future_owner_write(uuid)');
  expect(() =>
    assertCompleteManifest(registry, {
      ...audit,
      transports: [
        ...audit.transports,
        { name: 'future_owner_write', kind: 'literal', callee: 'rpc', evidence: 'fixture:1' },
      ],
    }),
  ).toThrow('unclassified transport fixture:1:rpc:future_owner_write');
});

test('validates fixed manifest entries against copied source evidence and rejects a new RPC callsite', async () => {
  const copy = await sourceCopy();
  try {
    await writeFile(
      join(copy, 'src/progress/futureRepository.ts'),
      "const client = { rpc: async (_name: string) => undefined };\nvoid client.rpc('append_learning_event');\n",
    );
    await expect(auditOwnerCutoverManifest(copy)).rejects.toThrow(
      'unclassified transport callsite src/progress/futureRepository.ts:2:rpc:append_learning_event',
    );
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
});

test('normalizes uppercase EXECUTE ACLs and rejects spaced public declarations', async () => {
  const copy = await sourceCopy();
  const migration = join(copy, 'supabase/migrations/999999999998_acl.sql');
  try {
    await writeFile(
      migration,
      'REVOKE EXECUTE ON FUNCTION public.dashboard_parse_timestamp(jsonb, boolean) FROM AUTHENTICATED;\nGRANT EXECUTE ON FUNCTION public.dashboard_parse_timestamp(jsonb, boolean) TO AUTHENTICATED;\n',
    );
    const functionAudit = await readSourceAudit(copy);
    expect(
      functionAudit.functions.find((entry) => entry.signature.startsWith('dashboard_parse_timestamp'))
        ?.roles,
    ).toEqual(['authenticated']);
    await writeFile(
      join(copy, 'supabase/migrations/999999999999_quoted.sql'),
      'CREATE FUNCTION "public" . "unexpected_owner_cutover"() RETURNS void LANGUAGE sql AS $$ SELECT; $$;',
    );
    await expect(readSourceAudit(copy)).rejects.toThrow('unsupported public function declaration');
    await writeFile(
      join(copy, 'supabase/migrations/999999999999_quoted.sql'),
      'CREATE FUNCTION public . unexpected_owner_cutover() RETURNS void LANGUAGE sql AS $$ SELECT; $$;',
    );
    await expect(readSourceAudit(copy)).rejects.toThrow('unsupported public function declaration');
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
});
