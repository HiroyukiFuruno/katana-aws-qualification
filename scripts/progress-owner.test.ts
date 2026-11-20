import { expect, test } from 'bun:test';
import {
  canPersistGuestProgress,
  guestProgressConsentKey,
  type ProgressOwner,
  sameProgressOwner,
  setGuestProgressConsent,
} from '../src/progress';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('a progress owner includes a generation so a new account session cannot reuse an old queue', () => {
  const member: ProgressOwner = { kind: 'member', generation: 4, userId: 'member-a' };
  expect(sameProgressOwner(member, { kind: 'member', generation: 4, userId: 'member-a' })).toBe(true);
  expect(sameProgressOwner(member, { kind: 'member', generation: 5, userId: 'member-a' })).toBe(false);
  expect(sameProgressOwner(member, { kind: 'member', generation: 4, userId: 'member-b' })).toBe(false);
});

test('guest persistence requires its own explicit consent and never uses the analytics preference', () => {
  const storage = memoryStorage();
  expect(canPersistGuestProgress(storage)).toBe(false);
  setGuestProgressConsent(storage, true);
  expect(storage.getItem(guestProgressConsentKey)).toBe('granted');
  expect(canPersistGuestProgress(storage)).toBe(true);
  setGuestProgressConsent(storage, false);
  expect(canPersistGuestProgress(storage)).toBe(false);
});
