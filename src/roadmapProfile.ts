import { profileKey } from './assessment';

export type Profile = { earned: string[]; answers: Record<string, number> };

export function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey) ?? 'null');
    return {
      earned: Array.isArray(saved?.earned)
        ? saved.earned
            .filter((id: unknown): id is string => typeof id === 'string')
            .map((id: string) => (id === 'sap-c02' ? 'sap-c03' : id))
        : [],
      answers: saved?.answers && typeof saved.answers === 'object' ? saved.answers : {},
    };
  } catch {
    return { earned: [], answers: {} };
  }
}
