import { deleteAccount } from '../../supabase/functions/delete-account/handler';
import { heldResponses } from './held-responses';
import { appOrigin, authOrigin, fixtureKey, gatewayOrigin, restOrigin } from './settings';

let finalizeFailure: 'after' | 'before' | undefined;
let expireBeforeSave: string | undefined;
const held = heldResponses((request) => forward(request, '/rest/v1', restOrigin));

function validExamId(examId: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(examId);
}

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

function expireExam(examId: string) {
  if (!validExamId(examId)) return false;
  const result = Bun.spawnSync([
    'docker',
    'compose',
    '-f',
    'test/data/compose.yml',
    'exec',
    '-T',
    'database',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'supabase_auth_admin',
    '-d',
    'kaq_data',
    '-c',
    `begin;
       update public.exam_sessions
         set started_at = clock_timestamp() - interval '2 seconds',
             deadline_at = clock_timestamp() - interval '1 second'
         where exam_id = '${examId}';
       update public.exam_responses
         set selected_at = case when selected = '[]'::jsonb then null else clock_timestamp() - interval '1500 milliseconds' end,
             updated_at = clock_timestamp() - interval '1500 milliseconds'
         where exam_id = '${examId}';
       commit;`,
  ]);
  if (result.exitCode !== 0) console.error(new TextDecoder().decode(result.stderr));
  return result.exitCode === 0;
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
      if (path === '/test/expire-before-save' && request.method === 'POST') {
        const examId = new URL(request.url).searchParams.get('exam_id') ?? '';
        if (!validExamId(examId)) return new Response('Invalid exam', { status: 400 });
        expireBeforeSave = examId;
        return new Response(null, { status: 204 });
      }
      if (path === '/test/expire-exam' && request.method === 'POST') {
        return expireExam(new URL(request.url).searchParams.get('exam_id') ?? '')
          ? new Response(null, { status: 204 })
          : new Response('Could not expire exam', { status: 400 });
      }
      if (path === '/test/fail-next-finalize' && request.method === 'POST') {
        const mode = new URL(request.url).searchParams.get('mode');
        if (mode !== 'after' && mode !== 'before')
          return new Response('Invalid fault mode', { status: 400 });
        finalizeFailure = mode;
        return new Response(null, { status: 204 });
      }
      const control = held.control(request);
      if (control) return control;
      if (path.startsWith('/auth/v1/'))
        return cors(await forward(request, '/auth/v1', authOrigin), request);
      if (path === '/rest/v1/rpc/finalize_exam_session' && finalizeFailure) {
        const mode = finalizeFailure;
        finalizeFailure = undefined;
        if (mode === 'after') {
          const forwarded = await forward(request.clone(), '/rest/v1', restOrigin);
          if (!forwarded.ok) return cors(forwarded, request);
        }
        return cors(new Response(null, { status: 503 }), request);
      }
      if (path === '/rest/v1/rpc/save_exam_response_confirmed' && expireBeforeSave) {
        const examId = expireBeforeSave;
        expireBeforeSave = undefined;
        if (!expireExam(examId))
          return cors(new Response('Could not expire exam', { status: 500 }), request);
      }
      const delayed = held.forward(request);
      if (delayed) return cors(await delayed, request);
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
