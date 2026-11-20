export type Profile = { earned: string[]; answers: Record<string, number> };

export const emptyProfile = (): Profile => ({ earned: [], answers: {} });
