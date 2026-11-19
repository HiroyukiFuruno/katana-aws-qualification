import { type DeleteAccountEnvironment, deleteAccount } from './handler.ts';

function environment(): DeleteAccountEnvironment | null {
  const authUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return authUrl && serviceRoleKey
    ? { authUrl, serviceRoleKey, allowedOrigin: 'https://kaq.katana-projects.org' }
    : null;
}

Deno.serve((request) => {
  const configured = environment();
  if (!configured) return new Response(null, { status: 500 });
  return deleteAccount(request, configured);
});
