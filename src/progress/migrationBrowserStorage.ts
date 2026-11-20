import { expireLegacyIncorrectCookie } from '../history';
import type { LegacyStorage } from './migrationTypes';

const incorrectCookie = 'saa_study_incorrect_v1';
export type LegacyCookie = { expire(): void; read(): string };

function cookieValue(cookie: string) {
  const prefix = `${incorrectCookie}=`;
  const entry = cookie.split('; ').find((item) => item.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

const browserCookie: LegacyCookie = { expire: expireLegacyIncorrectCookie, read: () => document.cookie };

export function createBrowserLegacyStorage(
  storage: Storage = localStorage,
  cookie: LegacyCookie = browserCookie,
): LegacyStorage {
  return {
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    keys: () =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
        (key): key is string => key !== null,
      ),
    readIncorrectCookie: () => cookieValue(cookie.read()),
    expireIncorrectCookie: () => cookie.expire(),
  };
}
