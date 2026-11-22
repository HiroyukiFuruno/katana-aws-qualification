export type LegacyProfile = {
  earned: string[];
  answers: Record<string, number>;
  optionOrders: Record<string, number[]>;
  order: string[];
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
export function profile(raw: string): LegacyProfile | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !object(parsed) ||
      !Array.isArray(parsed.earned) ||
      !object(parsed.answers) ||
      !parsed.earned.every((value) => typeof value === 'string') ||
      !Object.values(parsed.answers).every(Number.isInteger)
    )
      return undefined;
    const optionOrders =
      object(parsed.optionOrders) &&
      Object.values(parsed.optionOrders).every(
        (value) => Array.isArray(value) && value.every((index) => integer(index)),
      )
        ? (parsed.optionOrders as Record<string, number[]>)
        : {};
    const order =
      Array.isArray(parsed.order) && parsed.order.every((value) => typeof value === 'string')
        ? (parsed.order as string[])
        : [];
    return {
      earned: parsed.earned as string[],
      answers: parsed.answers as Record<string, number>,
      optionOrders,
      order,
    };
  } catch {
    return undefined;
  }
}
