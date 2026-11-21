import { AuthClient } from '@supabase/auth-js';

const adapterOrigin = 'http://127.0.0.1:54534';
const operationKey = 'kaq-account-sdk-operation';
declare global {
  interface Window {
    __kaqAccountSdkCallbackCode?: string | null;
  }
}
const client = new AuthClient({
  url: 'http://127.0.0.1:54530/auth/v1',
  storageKey: 'kaq.account-merge-smoke.v1',
  flowType: 'pkce',
  detectSessionInUrl: false,
  autoRefreshToken: false,
});

type StartReply = { legId: string; state: string; expiresAt: number; authorizationUrl?: string };
type ExchangeReply = { legId: string; state: string; expiresAt: number };

function status() {
  const element = document.querySelector<HTMLElement>('[role="status"]');
  if (!element) throw new Error('Missing SDK status');
  return element;
}

async function mainBearer() {
  const { data, error } = await client.getSession();
  if (error || !data.session) throw new Error('Missing main browser session');
  return data.session.access_token;
}

async function request<T>(path: string, token: string | null, body: object): Promise<T> {
  const response = await fetch(`${adapterOrigin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('SDK fixture request failed');
  return (await response.json()) as T;
}

async function start(side: 'source' | 'target') {
  const reply = await request<StartReply>('/start', await mainBearer(), { side });
  if (!reply.authorizationUrl) {
    status().textContent = reply.state;
    return;
  }
  sessionStorage.setItem(operationKey, reply.legId);
  const link = document.querySelector<HTMLAnchorElement>('[data-authorization]');
  if (!link) throw new Error('Missing authorization link');
  link.href = reply.authorizationUrl;
  link.hidden = false;
  status().textContent = 'authorization_ready';
}

async function callback() {
  const code = window.__kaqAccountSdkCallbackCode;
  delete window.__kaqAccountSdkCallbackCode;
  if (!code) return false;
  const legId = sessionStorage.getItem(operationKey);
  if (!legId) throw new Error('SDK operation is missing');
  const reply = await request<ExchangeReply>('/exchange', await mainBearer(), { legId, code });
  sessionStorage.removeItem(operationKey);
  status().textContent = reply.state;
  return true;
}

async function ready() {
  if (await callback()) return;
  for (const element of document.querySelectorAll<HTMLButtonElement>('[data-side]')) {
    element.addEventListener(
      'click',
      () =>
        void start(element.dataset.side as 'source' | 'target').catch(() => {
          status().textContent = 'failed';
        }),
    );
  }
  status().textContent = 'ready';
}

void ready().catch(() => {
  status().textContent = 'failed';
});

export async function mainSessionSnapshot() {
  const { data, error } = await client.getSession();
  if (error || !data.session) throw new Error('Missing main browser session');
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      local: Object.entries(localStorage).sort(),
      session: Object.entries(sessionStorage).sort(),
    }),
  );
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return {
    userId: data.session.user.id,
    storageHash: [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
}
