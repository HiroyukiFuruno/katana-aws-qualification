import { type Operation, SdkControl } from './control';
import { seedSourceMembership, seedTargetMembership } from './fixture-membership';
import { proofRacePort, proofWorker } from './proof-port';
import { auditSnapshot } from './server-audit';
import { cleanup } from './server-cleanup';
import { actor, body, listen, send, trackedServer } from './server-http';
import { sourceIntent, verifiedSourceScope } from './server-intent';
import type { AdapterOptions } from './server-options';
import { sdkWorker } from './server-sdk';
import { fingerprint, learnerCount, protectedHash } from './server-snapshot';
import { SdkTimings } from './server-timings';
import { requiredUuid, sql } from './sql';

export type { ProofRacePort } from './proof-port';
export async function startSdkAdapter(options: AdapterOptions = {}) {
  const timings = new SdkTimings(options.cleanupReceiptFilename);
  const operations = new Map<string, Operation>();
  const byActorAndSide = new Map<string, Operation>();
  const ownedMembership = { accountIds: new Set<string>(), aliasUserIds: new Set<string>() };
  let droppedProofResponse = false;
  const control = new SdkControl(operations, undefined, options.authorizationFailure === true);
  const worker = () => sdkWorker(control, operations);
  const baseline = fingerprint();
  const protectedBaseline = protectedHash(options.additionalPrivateTables ?? []);
  const auditBaseline = auditSnapshot();
  if (
    Number(
      sql(
        "select count(*) from auth.users where email in ('sdk-first@account-merge.example.test','sdk-second@account-merge.example.test');",
      ),
    ) !== 0
  )
    throw new Error('SDK users already exist before this fixture');
  const learnerBaseline = learnerCount();
  const { server, drain } = trackedServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:54533',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      });
      response.end();
      return;
    }
    const mark = timings.request(request.url);
    mark('started');
    try {
      const input = await body(request);
      const main = await actor(request);
      mark('actor');
      if (request.method !== 'POST') throw new Error('invalid request');
      if (request.url === '/start' && (input.side === 'source' || input.side === 'target')) {
        const key = `${main.userId}:${main.sessionId}:${input.side}`;
        const operation = byActorAndSide.get(key) ?? {
          actor: main,
          side: input.side,
          kind: options.intentKind ?? 'add_existing',
          provider: input.side === 'target' ? options.targetProvider : undefined,
        };
        if (operation.actor.userId !== main.userId || operation.actor.sessionId !== main.sessionId)
          throw new Error('invalid request');
        if (input.side === 'target' && operation.kind === 'merge_existing')
          operation.sourceScope = verifiedSourceScope(byActorAndSide, main);
        if (input.side === 'source') {
          operation.sourceScope = await seedSourceMembership(
            main,
            operation.kind ?? 'add_existing',
            ownedMembership,
          );
        }
        const result = await worker().begin(operation);
        if (result.legId) operations.set(result.legId, operation);
        if (result.legId) byActorAndSide.set(key, operation);
        send(response, 200, result);
        return;
      }
      if (
        request.url === '/exchange' &&
        typeof input.legId === 'string' &&
        typeof input.code === 'string'
      ) {
        const operation = operations.get(requiredUuid(input.legId));
        if (
          !operation ||
          operation.actor.userId !== main.userId ||
          operation.actor.sessionId !== main.sessionId
        )
          throw new Error('invalid request');
        const exchanged = await worker().exchange(operation, input.code);
        mark('exchange');
        const canonical = await control.loadCanonical(operation);
        if (exchanged.state !== 'exchanged' && canonical.state !== 'proved') {
          send(response, 200, exchanged);
          return;
        }
        if (exchanged.state === 'exchanged') {
          const port = await proofRacePort(operation, canonical, control);
          mark('port');
          await seedTargetMembership(
            port,
            ownedMembership,
            operation.kind ?? 'add_existing',
            main.userId,
            operation.sourceScope,
            options.targetSameOwner === true,
            options.targetExisting === true,
          );
          mark('membership');
          if (options.beforeProofAccept) await options.beforeProofAccept(port);
          mark('hook');
        }
        const accepted = await proofWorker(control, operations).accept(operation);
        mark('proof');
        if (options.dropProofResponse && !droppedProofResponse) {
          droppedProofResponse = true;
          response.destroy();
          return;
        }
        send(response, 200, accepted);
        return;
      }
      throw new Error('invalid request');
    } catch {
      send(response, 400, { error: 'invalid SDK fixture request' });
    }
  });
  await listen(server);
  return {
    close: () =>
      cleanup({
        operations,
        ownedMembership,
        timings,
        drain,
        baseline,
        protectedBaseline,
        additionalPrivateTables: options.additionalPrivateTables,
        learnerBaseline,
        auditBaseline,
        receiptFilename: options.cleanupReceiptFilename,
      }),
    proof: (options?: { allowRetainedNonce?: boolean }) => control.proof(options),
    verifyPostAcceptance: () => control.verifyPostAcceptance(),
    verifyAuthorizationFailure: () => control.verifyAuthorizationFailure(),
    assertNoCodeExchange: () => control.assertNoCodeExchange(),
    assertAuthorizationFailurePrivacy: control.assertAuthorizationFailurePrivacy.bind(control),
    intent: () => sourceIntent(operations),
    assertNoBrowserLeak: control.assertNoBrowserLeak.bind(control),
  };
}
