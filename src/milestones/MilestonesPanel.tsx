import { useMemo, useState } from 'react';
import { certifications } from '../certifications';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useContent } from '../useContent';
import { dateInTimezone } from './dates';
import { useMilestoneLabels } from './labels';
import { MilestoneAgenda } from './MilestoneAgenda';
import { MilestoneCalendar } from './MilestoneCalendar';
import { MilestoneForm } from './MilestoneForm';
import { MilestoneNotice } from './MilestoneNotice';
import { MilestoneSummary } from './MilestoneSummary';
import type { MilestonesModel } from './modelTypes';
import { agendaDate } from './presentationTypes';
import type { Milestone, MilestoneKind } from './types';
import './milestones.css';

export type MilestonesPanelProps = {
  model: MilestonesModel | null;
  timezone: string;
  certificationIds: readonly string[] | null;
  chart: 'calendar' | 'table';
  id: string;
};

export function MilestonesPanel({ model, timezone, certificationIds, chart, id }: MilestonesPanelProps) {
  const { locale, t } = usePreferences();
  const { content } = useContent();
  const labels = useMilestoneLabels();
  const [editing, setEditing] = useState<Milestone>();
  const [addingKind, setAddingKind] = useState<MilestoneKind>('study');
  const [adding, setAdding] = useState(false);
  const [operationId, setOperationId] = useState<string>();
  const [month, setMonth] = useState(() => {
    const today = dateInTimezone(new Date().toISOString(), timezone);
    return new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  });
  const items = useMemo(
    () =>
      model?.items.filter(
        (row) => !certificationIds || certificationIds.includes(row.certificationId),
      ) ?? [],
    [model?.items, certificationIds],
  );
  if (!model)
    return (
      <section id={id} className="milestones-panel card">
        <h2>{t('dashboardMilestones')}</h2>
        <p>{t('milestoneGuestPrompt')}</p>
        <a href={localePath(locale, 'login')}>{t('accountCreateCta')}</a>
      </section>
    );
  const remove = async (row: Milestone) => {
    if (window.confirm(t('milestoneDeleteConfirm', { title: row.title }))) await model.remove(row);
  };
  const today = dateInTimezone(new Date().toISOString(), timezone);
  const loadFailed = model.notice === 'load-error';
  const ready = !model.loading && !loadFailed;
  const reload = () => {
    if (editing) setEditing(undefined);
    model.reload();
  };
  const add = (kind: MilestoneKind) => {
    setEditing(undefined);
    setAddingKind(kind);
    setOperationId(crypto.randomUUID());
    setAdding(true);
  };
  return (
    <section id={id} className="milestones-panel card" aria-busy={model.loading}>
      <header>
        <div>
          <h2>{t('dashboardMilestones')}</h2>
          <p>{t('milestoneFilterScope')}</p>
          <p>{t('milestoneDisplayTimezone', { timezone })}</p>
        </div>
        <button type="button" onClick={() => add('study')} disabled={model.disabled}>
          {t('milestoneAddSchedule')}
        </button>
        <button type="button" onClick={() => add('target')} disabled={model.disabled}>
          {t('milestoneAddTarget')}
        </button>
      </header>
      <MilestoneNotice model={model} reload={reload} />
      {ready && (
        <MilestoneSummary
          items={items}
          today={today}
          timeZone={timezone}
          certifications={content.certifications}
        />
      )}
      {(adding || editing) && (
        <MilestoneForm
          key={editing ? `${editing.id}:${editing.revision}` : operationId}
          model={model}
          row={editing}
          kind={addingKind}
          certifications={certifications
            .filter(({ id }) => !certificationIds || certificationIds.includes(id))
            .map(({ id }) => ({
              id,
              name: content.certifications[id]?.name ?? id,
            }))}
          onCancel={() => {
            setAdding(false);
            setEditing(undefined);
          }}
          onSaved={(input) => {
            setAdding(false);
            setEditing(undefined);
            const date =
              input.plannedOn ?? (input.plannedAt ? dateInTimezone(input.plannedAt, timezone) : null);
            if (date) setMonth(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
          }}
        />
      )}
      {ready && chart === 'calendar' && (
        <MilestoneCalendar items={items} timeZone={timezone} month={month} onMonth={setMonth} />
      )}
      {ready && (
        <MilestoneAgenda
          items={
            chart === 'calendar'
              ? items.filter((row) =>
                  agendaDate(row, timezone).startsWith(
                    `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`,
                  ),
                )
              : items
          }
          timeZone={timezone}
          certifications={content.certifications}
          onEdit={(row) => {
            setEditing(row);
            setAdding(false);
          }}
          onDelete={remove}
          disabled={model.disabled}
        />
      )}
      {ready && items.length === 0 && <p>{t('milestoneNoPlans')}</p>}
      {ready && <p>{labels.t('milestoneTargetDeleteHelp')}</p>}
      <a href={localePath(locale, 'assessment')}>{t('earned')}</a>
    </section>
  );
}
