import { usePreferences } from '../preferences';
import { remainingDays } from './dates';
import { useMilestoneLabels } from './labels';
import { agendaRows, certificationName } from './presentationTypes';
import type { Milestone } from './types';

type Props = {
  items: readonly Milestone[];
  today: string;
  timeZone: string;
  certifications: Record<string, { name: string }>;
};

export function MilestoneSummary({ items, today, timeZone, certifications }: Props) {
  const labels = useMilestoneLabels();
  const { locale } = usePreferences();
  const rows = agendaRows(items, timeZone);
  const targets = rows.filter((row) => row.kind === 'target');
  const target = targets.find((row) => row.date >= today) ?? targets.at(-1);
  const next = rows.find(
    (row) =>
      row.kind !== 'target' &&
      !row.completed &&
      (row.plannedAt && row.instant !== null ? row.instant >= Date.now() : row.date >= today),
  );
  const days = target ? remainingDays(target.date, today) : null;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${value}T00:00:00Z`),
    );
  return (
    <div className="milestone-summary">
      <article>
        <h3>{labels.t('milestoneTargetDate')}</h3>
        <strong>{target ? formatDate(target.date) : labels.t('milestoneNoTargets')}</strong>
        {target && (
          <small>
            {certificationName(target.certificationId, certifications)} ·{' '}
            {new Intl.NumberFormat(locale).format(days ?? 0)} {labels.t('milestoneDaysToTarget')}
          </small>
        )}
      </article>
      <article>
        <h3>{labels.t('milestoneNextSchedule')}</h3>
        <strong>{next?.title ?? labels.t('milestoneNoUpcoming')}</strong>
        {next && (
          <small>
            {formatDate(next.date)} · {labels[next.kind]}
          </small>
        )}
      </article>
    </div>
  );
}
