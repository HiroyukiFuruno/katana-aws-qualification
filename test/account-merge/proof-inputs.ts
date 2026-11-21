import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requiredUuid } from '../account-sdk/sql';
import { artifacts } from './settings';

export function fixedProofInputs(): Record<string, string> {
  const smoke: unknown = JSON.parse(readFileSync(`${artifacts}/smoke-proof.json`, 'utf8'));
  assert(smoke && typeof smoke === 'object' && 'issuers' in smoke);
  assert(Array.isArray(smoke.issuers) && smoke.issuers.length === 2);
  const [first, second]: unknown[] = smoke.issuers;
  assert(first && typeof first === 'object' && 'userId' in first && 'sessionId' in first);
  assert(second && typeof second === 'object' && 'userId' in second);
  assert(typeof first.userId === 'string' && typeof first.sessionId === 'string');
  assert(typeof second.userId === 'string' && second.userId !== first.userId);
  return {
    __FIRST_USER__: requiredUuid(first.userId),
    __FIRST_SESSION__: requiredUuid(first.sessionId),
    __SECOND_USER__: requiredUuid(second.userId),
  };
}
