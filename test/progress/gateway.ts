import { deleteAccount } from '../../supabase/functions/delete-account/handler';
import { appOrigin, authOrigin, fixtureKey, gatewayOrigin, restOrigin } from './settings';

function targetFor(request: Request, prefix: string, origin: string) {
  const source = new URL(request.url);
  const path = source.pathname.slice(prefix.length) || '/';
  return new URL(`${path}${source.search}`, origin);
}

function forward(request: Request, prefix: string, origin: string) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetch(targetFor(request, prefix, origin), {
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    headers,
    method: request.method,
  });
}

function cors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', request.headers.get('origin') ?? appOrigin);
  headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') ??
      'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
  );
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function serveProgressGateway() {
  return Bun.serve({
    hostname: '127.0.0.1',
    port: Number(new URL(gatewayOrigin).port),
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), request);
      if (path === '/health') return new Response('ok');
      if (path.startsWith('/auth/v1/'))
        return cors(await forward(request, '/auth/v1', authOrigin), request);
      if (path.startsWith('/rest/v1/'))
        return cors(await forward(request, '/rest/v1', restOrigin), request);
      if (path === '/functions/v1/delete-account') {
        return cors(
          await deleteAccount(request, {
            allowedOrigin: appOrigin,
            authUrl: gatewayOrigin,
            serviceRoleKey: fixtureKey('service_role'),
          }),
          request,
        );
      }
      return new Response('Not found', { status: 404 });
    },
  });
}
