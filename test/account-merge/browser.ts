import { AuthClient, type Provider } from '@supabase/auth-js';

const client = new AuthClient({
  url: 'http://127.0.0.1:54530/auth/v1',
  storageKey: 'kaq.account-merge-smoke.v1',
  flowType: 'pkce',
  detectSessionInUrl: false,
  autoRefreshToken: false,
});

export async function verifiedSession() {
  const { data, error } = await client.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Missing OAuth session');
  const verified = await client.getUser(data.session.access_token);
  if (verified.error) throw verified.error;
  if (verified.data.user.id !== data.session.user.id) throw new Error('OAuth owner mismatch');
  return { accessToken: data.session.access_token, userId: verified.data.user.id };
}

export async function refreshVerifiedSession() {
  const { error } = await client.refreshSession();
  if (error) throw error;
  return (await verifiedSession()).accessToken;
}

async function ready() {
  const status = document.querySelector('[role="status"]');
  if (!status) throw new Error('Missing smoke status');
  const code = new URL(location.href).searchParams.get('code');
  if (code) {
    const { error } = await client.exchangeCodeForSession(code);
    history.replaceState({}, '', location.pathname);
    if (error) throw error;
    await verifiedSession();
    status.textContent = 'authenticated';
    return;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-provider]')) {
    button.addEventListener('click', () => {
      void client
        .signInWithOAuth({
          provider: button.dataset.provider as Provider,
          options: {
            redirectTo: `${location.origin}/test/account-merge/browser.html`,
            scopes: 'openid email profile',
            skipBrowserRedirect: true,
          },
        })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data.url) throw new Error('Missing OAuth URL');
          location.assign(data.url);
        })
        .catch((error: Error) => {
          status.textContent = error.message;
        });
    });
  }
  status.textContent = 'ready';
}

void ready().catch((error: Error) => {
  const status = document.querySelector('[role="status"]');
  if (status) status.textContent = error.message;
});
