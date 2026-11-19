export type AccountDeletionBackend = { url: string; key: string };

export async function requestAccountDeletion(
  backend: AccountDeletionBackend,
  accessToken: string,
): Promise<void> {
  const endpoint = new URL(backend.url);
  const localTestEndpoint =
    endpoint.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(endpoint.hostname);
  if ((endpoint.protocol !== 'https:' && !localTestEndpoint) || !backend.key || !accessToken) {
    throw new Error('Account deletion is unavailable');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, apikey: backend.key },
  });
  if (!response.ok) throw new Error('Account deletion failed');
}
