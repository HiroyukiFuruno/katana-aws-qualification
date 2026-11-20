import { profileKey } from './assessment';
import { getActiveProgressStore } from './history';
import type { Profile } from './progress/profileTypes';

export type { Profile } from './progress/profileTypes';

const updatedCertifications = new Map([
  ['dva-c02', 'dva-c03'],
  ['sap-c02', 'sap-c03'],
]);

export function loadProfile(): Profile {
  const store = getActiveProgressStore();
  if (store === null) throw new Error('ロードマップを初期化中です。');
  if (store) {
    const snapshot = store.getSnapshot();
    if (snapshot.state !== 'ready') throw new Error('ロードマップを読み込めませんでした。');
    return snapshot.profile;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey) ?? 'null');
    return {
      earned: Array.isArray(saved?.earned)
        ? [
            ...new Set<string>(
              saved.earned
                .filter((id: unknown): id is string => typeof id === 'string')
                .map((id: string) => updatedCertifications.get(id) ?? id),
            ),
          ]
        : [],
      answers: saved?.answers && typeof saved.answers === 'object' ? saved.answers : {},
    };
  } catch {
    return { earned: [], answers: {} };
  }
}

export async function saveProfile(profile: Profile, expectedStore = getActiveProgressStore()) {
  const current = getActiveProgressStore();
  if (expectedStore !== undefined && expectedStore !== current) {
    throw new Error('ロードマップの保存先が切り替わりました。');
  }
  if (expectedStore === null || current === null) throw new Error('ロードマップを初期化中です。');
  if (expectedStore) {
    const result = await expectedStore.replaceProfile(profile);
    if (expectedStore !== getActiveProgressStore()) {
      throw new Error('ロードマップの保存先が切り替わりました。');
    }
    return result;
  }
  localStorage.setItem(profileKey, JSON.stringify(profile));
}
