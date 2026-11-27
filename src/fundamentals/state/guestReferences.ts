import { guestLessonPrefix } from '../../learningStorage';
import { type BrowserStorage, canPersistGuestProgress } from '../../progress/guest';

export type GuestLessonReference = { contentVersion: string; unitId: string };

type EnumeratedStorage = Pick<BrowserStorage, 'key' | 'length'>;

export function guestLessonKey({ unitId, contentVersion }: GuestLessonReference) {
  return `${guestLessonPrefix}${unitId}.${contentVersion}`;
}

export function guestLessonReference(key: string): GuestLessonReference | undefined {
  if (!key.startsWith(guestLessonPrefix)) return undefined;
  const match = /^(fundamentals\.[a-z0-9]+(?:-[a-z0-9]+)*)\.([a-f0-9]{64})$/.exec(
    key.slice(guestLessonPrefix.length),
  );
  if (!match?.[1] || !match[2]) return undefined;
  return { unitId: match[1], contentVersion: match[2] };
}

export function guestLessonKeys(storage: EnumeratedStorage) {
  const keys: string[] = [];
  for (let offset = 0; offset < (storage.length ?? 0); offset++) {
    const key = storage.key?.(offset);
    if (key?.startsWith(guestLessonPrefix)) keys.push(key);
  }
  return keys;
}

export function guestLessonReferences(storage: BrowserStorage, memory: Iterable<string>) {
  const saved = canPersistGuestProgress(storage) ? guestLessonKeys(storage) : [];
  return Array.from(new Set([...memory, ...saved])).flatMap((key) => {
    const reference = guestLessonReference(key);
    return reference ? [reference] : [];
  });
}
