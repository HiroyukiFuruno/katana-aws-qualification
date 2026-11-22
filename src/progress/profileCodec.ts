import { normalizeCertificationId } from '../certificationAliases';
import { emptyProfile, type Profile } from './profileTypes';

export { emptyProfile, type Profile } from './profileTypes';

export function parseStoredProfile(value: string | null) {
  if (value === null) return emptyProfile();
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid roadmap profile.');
  const profile = parsed as Profile;
  return {
    earned: Array.isArray(profile.earned)
      ? [
          ...new Set(
            profile.earned
              .filter((id): id is string => typeof id === 'string')
              .map(normalizeCertificationId),
          ),
        ]
      : [],
    answers: profile.answers ?? {},
    optionOrders:
      profile.optionOrders &&
      typeof profile.optionOrders === 'object' &&
      !Array.isArray(profile.optionOrders)
        ? Object.fromEntries(
            Object.entries(profile.optionOrders).flatMap(([key, value]) =>
              Array.isArray(value) && value.every((index) => Number.isSafeInteger(index))
                ? [[key, value]]
                : [],
            ),
          )
        : {},
    order: Array.isArray(profile.order)
      ? profile.order.filter((id): id is string => typeof id === 'string')
      : [],
  };
}
