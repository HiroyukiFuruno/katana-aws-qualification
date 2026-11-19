import {
  deleteAccount,
  type DeleteAccountEnvironment,
} from '../../supabase/functions/delete-account/handler';
import { testKey } from './settings';

const environment: DeleteAccountEnvironment = {
  authUrl: process.env.SUPABASE_URL ?? 'http://gateway',
  serviceRoleKey: testKey('service_role'),
  allowedOrigin: process.env.KAQ_APP_ORIGIN ?? 'http://127.0.0.1:5173',
};

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: Number(process.env.KAQ_DELETE_ACCOUNT_TEST_PORT ?? '54332'),
  fetch: (request) => deleteAccount(request, environment),
});

console.log(`delete-account test server listening on ${server.url}`);
