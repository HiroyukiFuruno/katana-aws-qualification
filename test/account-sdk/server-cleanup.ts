import { writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { artifacts } from '../account-merge/settings';
import type { Operation } from './control';
import { type auditSnapshot, verifyAudit } from './server-audit';
import { fingerprint, learnerCount, protectedHash, protectedTables } from './server-snapshot';
import { literal, requiredUuid, sql } from './sql';

type CleanupInput = {
  operations: Map<string, Operation>;
  server: Server;
  baseline: string;
  protectedBaseline: string;
  learnerBaseline: string;
  auditBaseline: ReturnType<typeof auditSnapshot>;
  receiptFilename?: string;
};

export async function cleanup({
  operations,
  server,
  baseline,
  protectedBaseline,
  learnerBaseline,
  auditBaseline,
  receiptFilename = 'sdk-cleanup.json',
}: CleanupInput) {
  try {
    const intentIds = [
      ...new Set(
        [...operations.values()].flatMap((operation) =>
          operation.intent?.id ? [operation.intent.id] : [],
        ),
      ),
    ];
    if (intentIds.length)
      sql(
        `delete from kaq_private.account_intents where id in (${intentIds.map((id) => `${literal(id)}::uuid`).join(',')});`,
      );
    const emails = ['sdk-first@account-merge.example.test', 'sdk-second@account-merge.example.test'];
    const value = sql(
      `select coalesce(json_agg(id::text order by id),'[]'::json) from auth.users where email = any(array[${emails.map(literal).join(',')}]);`,
    );
    const userIds: string[] = JSON.parse(value) as string[];
    if (userIds.length)
      sql(
        `delete from auth.users where id in (${userIds.map((id) => `${literal(requiredUuid(id))}::uuid`).join(',')});`,
      );
    const remaining = sql(
      `select count(*) from kaq_private.account_intents where id in (${intentIds.length ? intentIds.map((id) => `${literal(id)}::uuid`).join(',') : 'null::uuid'});`,
    );
    const publicHash = fingerprint();
    const audit = verifyAudit(auditBaseline, userIds);
    const protectedFinal = protectedHash();
    const learnerFinal = learnerCount();
    const receipt = {
      status: 'passed',
      ownedIntents: intentIds.length,
      removedAuthUsers: userIds.length,
      remainingIntents: Number(remaining),
      publicBaselineHash: baseline,
      publicFinalHash: publicHash,
      publicUnchanged: baseline === publicHash,
      protectedBaseline,
      protectedFinal,
      protectedUnchanged: protectedBaseline === protectedFinal,
      protectedTables: protectedTables(),
      audit,
      learnerBaseline,
      learnerFinal,
      learnerUnchanged: learnerBaseline === learnerFinal,
    };
    if (!/^sdk(?:-[a-z]+)*-cleanup\.json$/.test(receiptFilename))
      throw new Error('Invalid SDK cleanup receipt filename');
    writeFileSync(`${artifacts}/${receiptFilename}`, `${JSON.stringify(receipt, null, 2)}\n`);
    if (
      receipt.remainingIntents !== 0 ||
      !receipt.publicUnchanged ||
      !receipt.protectedUnchanged ||
      !receipt.learnerUnchanged
    )
      throw new Error('SDK fixture cleanup verification failed');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
