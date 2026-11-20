export type ExamClock = { serverTime: number; monotonicTime: number };

export function createExamClock(serverISO: string): ExamClock {
  const serverTime = Date.parse(serverISO);
  if (!Number.isFinite(serverTime)) throw new Error('Invalid exam server time.');
  return { serverTime, monotonicTime: performance.now() };
}

export function examNow(draft?: { clock?: ExamClock }) {
  if (!draft?.clock) return Date.now();
  return draft.clock.serverTime + Math.max(0, performance.now() - draft.clock.monotonicTime);
}

export function elapsedExamMs(since: number, end = performance.now()) {
  return Math.max(0, Math.floor(end - since));
}
