import { writeFileSync } from 'node:fs';
import { artifacts, gatewayOrigin, testKey } from '../account-merge/settings';
import type { Operation } from './control';
import type { OwnedMembership } from './fixture-membership';
import { closeRuntimeSql } from './runtime-sql';
import { type auditSnapshot, verifyAudit } from './server-audit';
import { fingerprint, learnerCount, protectedHash, protectedTables } from './server-snapshot';
import type { SdkTimings } from './server-timings';
import { literal, requiredUuid, sql } from './sql';

type CleanupInput = {
  operations: Map<string, Operation>;
  ownedMembership: OwnedMembership;
  timings: SdkTimings;
  drain(): Promise<void>;
  baseline: string;
  protectedBaseline: string;
  learnerBaseline: string;
  auditBaseline: ReturnType<typeof auditSnapshot>;
  additionalPrivateTables?: readonly string[];
  receiptFilename?: string;
};

export async function cleanup({
  operations,
  ownedMembership,
  timings,
  drain,
  baseline,
  protectedBaseline,
  learnerBaseline,
  auditBaseline,
  additionalPrivateTables = [],
  receiptFilename = 'sdk-cleanup.json',
}: CleanupInput) {
  try {
    await drain();
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
    const ownedAccountIds = [...ownedMembership.accountIds];
    if (ownedAccountIds.length)
      sql(
        `delete from kaq_private.learning_session_grants where account_id in (${ownedAccountIds.map((id) => `${literal(requiredUuid(id))}::uuid`).join(',')});
         delete from kaq_private.learning_memberships where account_id in (${ownedAccountIds.map((id) => `${literal(requiredUuid(id))}::uuid`).join(',')});
         delete from public.learning_state where user_id in (${ownedAccountIds.map((id) => `${literal(requiredUuid(id))}::uuid`).join(',')});
         delete from kaq_private.learning_accounts where id in (${ownedAccountIds.map((id) => `${literal(requiredUuid(id))}::uuid`).join(',')});`,
      );
    if (userIds.length)
      sql(
        `delete from auth.users where id in (${userIds.map((id) => `${literal(requiredUuid(id))}::uuid`).join(',')});`,
      );
    const token = testKey('service_role');
    for (const aliasId of ownedMembership.aliasUserIds) {
      const response = await fetch(`${gatewayOrigin}/auth/v1/admin/users/${requiredUuid(aliasId)}`, {
        method: 'DELETE',
        headers: { apikey: token, Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('owner alias cleanup failed');
    }
    const remaining = sql(
      `select count(*) from kaq_private.account_intents where id in (${intentIds.length ? intentIds.map((id) => `${literal(id)}::uuid`).join(',') : 'null::uuid'});`,
    );
    const publicHash = fingerprint();
    const audit = verifyAudit(auditBaseline, userIds, [...ownedMembership.aliasUserIds]);
    const protectedFinal = protectedHash(additionalPrivateTables);
    const learnerFinal = learnerCount();
    const receipt = {
      status: 'passed',
      ownedIntents: intentIds.length,
      removedAccounts: ownedAccountIds.length,
      removedOwnerAliases: ownedMembership.aliasUserIds.size,
      removedAuthUsers: userIds.length,
      remainingIntents: Number(remaining),
      publicBaselineHash: baseline,
      publicFinalHash: publicHash,
      publicUnchanged: baseline === publicHash,
      protectedBaseline,
      protectedFinal,
      protectedUnchanged: protectedBaseline === protectedFinal,
      protectedTables: protectedTables(additionalPrivateTables),
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
    await closeRuntimeSql();
    timings.write();
  }
}
