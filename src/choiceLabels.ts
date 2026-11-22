export function choiceLabel(choices: readonly { id: string }[], id: string) {
  const index = choices.findIndex((choice) => choice.id === id);
  return index < 0 ? id : String.fromCodePoint(65 + index);
}

export function answerLabels(choices: readonly { id: string }[], ids: readonly string[]) {
  return ids.map((id) => choiceLabel(choices, id)).join('・');
}
