import { readFileSync } from 'node:fs';
import { requiredUuid, sql } from './sql';

type Operation = { intent?: { id: string }; legId?: string };
type ProofReport = { legId: string; authUserId: string };

export function verifyProofPostconditions(source: Operation, target: Operation, reports: ProofReport[]) {
  if (!source.intent || !source.legId || !target.intent || !target.legId)
    throw new Error('missing proof operations');
  if (source.intent.id !== target.intent.id) throw new Error('proof intent mismatch');
  const sourceProof = reports.find((proof) => proof.legId === source.legId);
  const targetProof = reports.find((proof) => proof.legId === target.legId);
  if (!sourceProof || !targetProof) throw new Error('missing proof report');
  const query = readFileSync('test/account-merge/proof-accept-postconditions.sql', 'utf8')
    .replaceAll('__INTENT_ID__', requiredUuid(source.intent.id))
    .replaceAll('__SOURCE_LEG__', requiredUuid(source.legId))
    .replaceAll('__TARGET_LEG__', requiredUuid(target.legId))
    .replaceAll('__SOURCE_UID__', requiredUuid(sourceProof.authUserId))
    .replaceAll('__TARGET_UID__', requiredUuid(targetProof.authUserId));
  const line = sql(query)
    .split('\n')
    .find((value) => value.startsWith('{'));
  if (!line) throw new Error('missing proof postcondition receipt');
  const value: unknown = JSON.parse(line);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid proof postcondition receipt');
  const receipt = value as Record<string, unknown>;
  if (
    receipt.status !== 'passed' ||
    receipt.checkCount !== 7 ||
    !Array.isArray(receipt.checks) ||
    new Set(receipt.checks).size !== 7 ||
    !receipt.checks.every((name) => typeof name === 'string')
  )
    throw new Error('proof postconditions did not pass');
  return { checks: receipt.checkCount, names: [...receipt.checks].sort() };
}
