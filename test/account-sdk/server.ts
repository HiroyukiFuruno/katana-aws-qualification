import { createServer } from 'node:http';
import { ServerSdkWorker } from '../../supabase/functions/account-linking/server/sdk-worker.ts';
import { gatewayOrigin, testKey } from '../account-merge/settings';
import { type Operation, SdkControl } from './control';
import { storage } from './runtime';
import { auditSnapshot } from './server-audit';
import { cleanup } from './server-cleanup';
import { actor, body, send } from './server-http';
import { fingerprint, learnerCount, protectedHash } from './server-snapshot';
import { requiredUuid, sql } from './sql';

const callback = 'http://127.0.0.1:54533/test/account-sdk/callback.html';

export async function startSdkAdapter() {
  const operations = new Map<string, Operation>();
  const byActorAndSide = new Map<string, Operation>();
  const control = new SdkControl(operations);
  const worker = () =>
    new ServerSdkWorker({
      control,
      storage: (leg) => {
        const operation = operations.get(leg.id);
        if (!operation) throw new Error('unknown SDK operation');
        return storage(operation.actor, leg);
      },
      url: gatewayOrigin,
      key: testKey(),
      fetch: control.fetch,
      providers: {
        keycloak: { callback, scopes: 'openid email profile' },
        azure: { callback, scopes: 'openid email profile' },
      },
    });
  const baseline = fingerprint();
  const protectedBaseline = protectedHash();
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
  const server = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:54533',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      });
      response.end();
      return;
    }
    try {
      const input = await body(request);
      const main = await actor(request);
      if (request.method !== 'POST') throw new Error('invalid request');
      if (request.url === '/start' && (input.side === 'source' || input.side === 'target')) {
        const key = `${main.userId}:${main.sessionId}:${input.side}`;
        const operation = byActorAndSide.get(key) ?? { actor: main, side: input.side };
        if (operation.actor.userId !== main.userId || operation.actor.sessionId !== main.sessionId)
          throw new Error('invalid request');
        const result = await worker().begin(operation);
        if (result.legId) {
          operations.set(result.legId, operation);
          byActorAndSide.set(key, operation);
        }
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
        send(response, 200, await worker().exchange(operation, input.code));
        return;
      }
      throw new Error('invalid request');
    } catch {
      send(response, 400, { error: 'invalid SDK fixture request' });
    }
  });
  await new Promise<void>((resolve, reject) =>
    server.listen(54534, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve())),
  );
  return {
    close: () =>
      cleanup({ operations, server, baseline, protectedBaseline, learnerBaseline, auditBaseline }),
    proof: () => control.proof(),
    assertNoBrowserLeak: (values: string[]) => control.assertNoBrowserLeak(values),
  };
}
