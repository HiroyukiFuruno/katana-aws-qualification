import { ServerSdkWorker } from '../../supabase/functions/account-linking/server/sdk-worker.ts';
import { gatewayOrigin, testKey } from '../account-merge/settings';
import type { Operation, SdkControl } from './control';
import { storage } from './runtime';
import { callback } from './server-options';

export function sdkWorker(control: SdkControl, operations: Map<string, Operation>) {
  return new ServerSdkWorker({
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
}
