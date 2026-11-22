import { usePreferences } from '../preferences';
import { useMilestoneLabels } from './labels';
import { MilestoneLink } from './MilestoneLink';
import { agendaRows, certificationName } from './presentationTypes';
import type { Milestone } from './types';

type Props = {
  items: readonly Milestone[];
  timeZone: string;
  certifications: Record<string, { name: string }>;
  onEdit: (row: Milestone) => void;
  onDelete: (row: Milestone) => void;
  disabled: boolean;
};

export function MilestoneAgenda({ items, timeZone, certifications, onEdit, onDelete, disabled }: Props) {
  const labels = useMilestoneLabels();
  const { locale } = usePreferences();
  return (
    <ol className="milestone-agenda">
      {agendaRows(items, timeZone).map((row) => (
        <li key={row.id} className={`milestone-row milestone-kind-${row.kind}`}>
          <div>
            <strong>{labels[row.kind]}</strong>
            <span>{row.title}</span>
            {row.completed && <span>{labels.completed}</span>}
            <small>
              {certificationName(row.certificationId, certifications)} ·{' '}
              {new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium' }).format(
                new Date(`${row.date}T00:00:00Z`),
              )}
              {row.plannedAt &&
                ` ${new Intl.DateTimeFormat(locale, { timeZone, timeStyle: 'short' }).format(new Date(row.plannedAt))}`}
            </small>
          </div>
          <div className="milestone-row-actions">
            <MilestoneLink row={row} />
            <button type="button" onClick={() => onEdit(row)} disabled={disabled}>
              {labels.t('milestoneEdit')}
            </button>
            <button type="button" onClick={() => onDelete(row)} disabled={disabled}>
              {labels.t('milestoneDelete')}
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
