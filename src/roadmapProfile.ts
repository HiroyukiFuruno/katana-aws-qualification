import { profileKey } from './assessment';

export type Profile = { earned: string[]; answers: Record<string, number> };

const updatedCertifications = new Map([
  ['dva-c02', 'dva-c03'],
  ['sap-c02', 'sap-c03'],
]);

export function loadProfile(): Profile {
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
