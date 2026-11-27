import type { LessonRecordQuestion } from '../delivery/recordAsset';

export function copyCompatibleSelection(
  previous: LessonRecordQuestion,
  current: LessonRecordQuestion,
  selected: readonly string[],
  aliases: Readonly<Partial<Record<string, string>>> = {},
) {
  const map = (id: string) => aliases[id] ?? id;
  const allowed = new Set(previous.choices.map(({ id }) => id));
  const mappedChoices = new Set([...allowed].map(map));
  if (
    previous.id !== current.id ||
    previous.selectionPolarity !== current.selectionPolarity ||
    previous.requiredChoices !== current.requiredChoices ||
    previous.correct.length !== current.correct.length ||
    !previous.correct.every((id) => current.correct.includes(map(id))) ||
    mappedChoices.size !== allowed.size ||
    mappedChoices.size !== current.choices.length ||
    !current.choices.every(({ id }) => mappedChoices.has(id)) ||
    selected.length !== current.requiredChoices ||
    new Set(selected).size !== selected.length ||
    !selected.every((id) => allowed.has(id))
  )
    return undefined;
  return selected.map(map);
}
