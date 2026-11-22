export function normalizeChoiceOrder(
  stored: readonly string[] | undefined,
  choices: readonly { id: string }[],
) {
  const canonical = choices.map(({ id }) => id);
  const remaining = new Set(canonical);
  if (
    remaining.size === canonical.length &&
    stored?.length === canonical.length &&
    stored.every((id) => remaining.delete(id)) &&
    remaining.size === 0
  ) {
    return [...stored];
  }
  return canonical;
}
