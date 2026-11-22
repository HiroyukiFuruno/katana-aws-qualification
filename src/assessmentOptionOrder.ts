import type { AssessmentItem } from './assessmentTypes';
import type { Profile } from './progress/profileTypes';

export function filterAssessmentProfile(
  profile: Profile,
  earned: string[],
  remaining: Set<string>,
): Profile {
  return {
    earned,
    answers: Object.fromEntries(Object.entries(profile.answers).filter(([id]) => remaining.has(id))),
    optionOrders: Object.fromEntries(
      Object.entries(profile.optionOrders).filter(([id]) => remaining.has(id)),
    ),
    order: [],
  };
}
import { shuffle } from './randomization';

export function assessmentComplete(items: AssessmentItem[], answers: Record<string, number>) {
  return (
    items.length > 0 &&
    items.every(
      ({ id, options }) =>
        Number.isInteger(answers[id]) && answers[id] >= 0 && answers[id] <= options.length,
    )
  );
}

export function ensureAssessmentPresentation(profile: Profile, items: AssessmentItem[]): Profile {
  const randomized = randomOptionOrders(items);
  return {
    ...profile,
    order: hasValidOrder(items, profile.order) ? profile.order : shuffle(items.map(({ id }) => id)),
    optionOrders: Object.fromEntries(
      items.map(({ id, options }) => [
        id,
        validOptionOrder(profile.optionOrders[id], options.length)
          ? profile.optionOrders[id]
          : randomized[id],
      ]),
    ),
  };
}

export function hasValidOrder(items: AssessmentItem[], order: string[]) {
  const ids = new Set(items.map(({ id }) => id));
  return (
    order.length === ids.size && new Set(order).size === ids.size && order.every((id) => ids.has(id))
  );
}

export function orderedItems(items: AssessmentItem[], order: string[]) {
  if (!hasValidOrder(items, order)) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  return order.map((id) => byId.get(id) as AssessmentItem);
}

export function validOptionOrder(order: number[] | undefined, optionCount: number): order is number[] {
  return (
    Array.isArray(order) &&
    order.length === optionCount + 1 &&
    new Set(order).size === order.length &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index <= optionCount)
  );
}

export function randomOptionOrders(items: { id: string; options: readonly unknown[] }[]) {
  return Object.fromEntries(
    items.map(({ id, options }) => [id, shuffle([...options.keys(), options.length])]),
  );
}
