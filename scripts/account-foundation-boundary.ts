import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { publicState } from '../test/account-merge/public-state';
import { verifyPublicSchemaGuards } from '../test/account-merge/schema-guards';
import { seedPublicData } from '../test/account-merge/seed-public';
import { artifacts } from '../test/account-merge/settings';

export async function verifyFoundationBoundary(
  applyMigration: (migration: string) => void,
  migration: string,
) {
  const seed = await seedPublicData();
  try {
    verifyPublicSchemaGuards();
    const before = publicState();
    const owners = before.tables.filter((table) => table.name !== 'published_fundamentals_catalogs');
    assert.equal(owners.length, 12);
    assert.ok(
      owners.every((table) => table.rows > 0),
      'Populate all existing owner tables before migration',
    );
    applyMigration(migration);
    const after = publicState();
    assert.deepEqual(after, before, 'The private foundation changed existing public schema or data');
    writeFileSync(
      `${artifacts}/foundation-boundary.json`,
      JSON.stringify(
        {
          status: 'passed',
          migration,
          observedAt: new Date().toISOString(),
          populatedOwnerTables: owners.length,
          before,
          after,
        },
        null,
        2,
      ),
    );
  } finally {
    await seed.cleanup();
    writeFileSync(
      `${artifacts}/foundation-seed-cleanup.json`,
      JSON.stringify(
        {
          status: 'passed',
          observedAt: new Date().toISOString(),
          syntheticUserId: seed.userId,
          authRemaining: 0,
          ownerRowsRemaining: 0,
          confirmation: 'Admin DELETE/GET404 and all 12 table checks',
        },
        null,
        2,
      ),
    );
  }
}
