type ExitLessonInput = {
  busy: boolean;
  final: boolean;
  pending: boolean;
  hasDurablePending: () => boolean;
  isCurrent: () => boolean;
  save: () => Promise<void>;
  leave: () => void;
};

export async function exitLesson(input: ExitLessonInput) {
  if (input.busy || !input.isCurrent()) return;
  if (!input.final) return input.leave();
  if (!input.pending) {
    await input.save();
    if (!input.isCurrent()) return;
  }
  // 最終回答は保存成功か耐久キューへの保持を確認してから画面を離れる。
  if (!input.hasDurablePending()) throw new Error('The current final answer could not be retained.');
  input.leave();
}
