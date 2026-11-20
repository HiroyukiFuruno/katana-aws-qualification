import type { SessionRow } from './examRepositoryCodec';

export type SubmittedEventRow = {
  answered_at: string;
  certification_id: string;
  exam_id?: string | null;
  mode: string;
};

function dateOf(value: string | null | undefined, source: string) {
  if (value === null || value === undefined) return undefined;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) throw new Error(`Invalid submitted exam date: ${source}`);
  return date;
}

export async function pickLatestSubmitted(
  sessions: SessionRow[],
  certificationId: string,
  loadEvents: () => Promise<SubmittedEventRow[]>,
) {
  const candidates = sessions.filter(
    (session) => session.certification_id === certificationId && session.state === 'submitted',
  );
  if (!candidates.length) return undefined;
  const eventDates = new Map<string, number>();
  const candidateIds = new Set(candidates.map((session) => session.exam_id));
  if (candidates.some((session) => session.submitted_at == null && session.started_at == null)) {
    for (const event of await loadEvents()) {
      if (
        event.certification_id !== certificationId ||
        event.mode !== 'exam' ||
        !event.exam_id ||
        !candidateIds.has(event.exam_id)
      )
        throw new Error('Unknown submitted exam event source.');
      const date = dateOf(event.answered_at, `event:${event.exam_id}`);
      if (date === undefined) throw new Error(`Invalid submitted exam date: event:${event.exam_id}`);
      eventDates.set(event.exam_id, Math.max(eventDates.get(event.exam_id) ?? date, date));
    }
  }
  const dated = candidates.map((session) => {
    const date =
      dateOf(session.submitted_at, `session:${session.exam_id}:submitted`) ??
      dateOf(session.started_at, `session:${session.exam_id}:started`) ??
      eventDates.get(session.exam_id);
    if (date === undefined) throw new Error(`Submitted exam date unavailable: ${session.exam_id}`);
    return { date, session };
  });
  const latest = dated.sort(
    (left, right) => right.date - left.date || left.session.exam_id.localeCompare(right.session.exam_id),
  )[0];
  if (!latest) throw new Error('Submitted exam date unavailable.');
  return latest.session;
}
