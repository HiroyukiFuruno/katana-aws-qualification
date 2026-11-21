import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import type { SdkInspection } from './control-inspection';

export function assertProofReports(
  proof: Awaited<ReturnType<SdkInspection['proof']>>,
  mainUserId: string,
) {
  expect(proof).toHaveLength(2);
  const source = proof.find((entry) => entry.side === 'source');
  const target = proof.find((entry) => entry.side === 'target');
  assert.ok(source && target);
  for (const entry of proof) {
    expect(entry.state).toBe('proved');
    expect(entry.purpose).toBe('proof');
    expect(entry.ingestNonceRemoved).toBe(true);
    expect(entry.providerTokensStripped).toBe(true);
    expect(entry.actorUid).toBe(mainUserId);
    expect(entry.actorSessionId).toBe(source.actorSessionId);
    expect(entry.sessionId).not.toBe(entry.actorSessionId);
  }
  expect(source.authUserId).toBe(mainUserId);
  expect(target.authUserId).not.toBe(mainUserId);
  expect(target.sessionId).not.toBe(source.sessionId);
  expect(target.expiresAt).toBe(source.expiresAt);
}
