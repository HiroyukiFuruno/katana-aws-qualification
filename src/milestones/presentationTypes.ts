import { dateInTimezone } from './dates';
import type { Milestone, MilestoneKind } from './types';

export type MilestoneLabels = Record<MilestoneKind | 'title' | 'date' | 'completed', string>;
export type AgendaRow = Milestone & { date: string; instant: number | null };

export function agendaDate(row: Milestone, timeZone: string): string {
  if (row.plannedOn) return row.plannedOn;
  if (!row.plannedAt) return row.plannedOn ?? '';
  return dateInTimezone(row.plannedAt, timeZone);
}

export function agendaRows(items: readonly Milestone[], timeZone: string): AgendaRow[] {
  return items
    .map((row) => ({
      ...row,
      date: agendaDate(row, timeZone),
      instant: row.plannedAt ? Date.parse(row.plannedAt) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.instant ?? 0) - (b.instant ?? 0));
}

export function certificationName(id: string, certifications: Record<string, { name: string }>) {
  return certifications[id]?.name ?? id;
}
