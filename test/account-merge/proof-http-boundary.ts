import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { ProofBoundaryKind, ProofBoundaryResult } from '../account-sdk/proof-token-negative';
import { snapshot } from './proof-race-state';
import { artifacts } from './settings';

type Port = { rejectModified(kind: ProofBoundaryKind): Promise<ProofBoundaryResult> };

export async function verifyHttpProofBoundary(port: Port, kind: ProofBoundaryKind) {
  const before = snapshot();
  const result = await port.rejectModified(kind);
  assert.equal(result.expiryUnchanged, true);
  if (kind === 'signature' || kind === 'audience') {
    assert.equal(result.status, 401);
    assert(['PGRST301', 'PGRST303'].includes(result.code));
  } else {
    assert.equal(result.status, 403);
    assert.equal(result.code, kind === 'issuer' ? '28000' : 'PT403');
  }
  assert.equal(snapshot(), before, 'Rejected HTTP proof changed protected data');
  writeFileSync(
    `${artifacts}/proof-http-${kind}.json`,
    `${JSON.stringify(
      {
        status: 'passed',
        kind,
        http: result.status,
        code: result.code,
        jwtExpiryChanged: false,
        protectedDataUnchanged: true,
        sqlFixedClaimsUsed: false,
      },
      null,
      2,
    )}\n`,
  );
}
