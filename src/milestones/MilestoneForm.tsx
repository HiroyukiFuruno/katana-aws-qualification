import { useState } from 'react';
import { validateMilestoneInput } from './codec';
import { localDateTimeInput, parseLocalDateTime } from './dates';
import { useMilestoneLabels } from './labels';
import { MilestoneFormFields } from './MilestoneFormFields';
import type { MilestonesModel } from './modelTypes';
import type { Milestone, MilestoneInput, MilestoneKind } from './types';
import './milestone-form.css';

type Props = {
  model: MilestonesModel;
  row?: Milestone;
  kind?: MilestoneKind;
  certifications: readonly { id: string; name: string }[];
  onCancel: () => void;
  onSaved: (input: MilestoneInput) => void;
};
type Draft = {
  id: string;
  certificationId: string;
  kind: MilestoneKind;
  title: string;
  plannedOn: string;
  plannedAt: string;
  allDay: boolean;
  completed: boolean;
};

export function MilestoneForm({ model, row, kind, certifications, onCancel, onSaved }: Props) {
  const labels = useMilestoneLabels();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [draft, setDraft] = useState<Draft>(() => ({
    id: row?.id ?? crypto.randomUUID(),
    certificationId: row?.certificationId ?? certifications[0]?.id ?? '',
    kind: row?.kind ?? kind ?? 'study',
    title: row?.title ?? '',
    plannedOn: row?.plannedOn ?? '',
    plannedAt: row?.plannedAt ? localDateTimeInput(row.plannedAt) : '',
    allDay:
      (row?.kind ?? kind) === 'target' || (row?.plannedOn !== null && row?.plannedOn !== undefined),
    completed: row?.completed ?? false,
  }));
  const [error, setError] = useState<string>();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const plannedAt = draft.allDay ? null : draft.plannedAt ? parseLocalDateTime(draft.plannedAt) : null;
    if (draft.plannedAt && !plannedAt) return setError(labels.t('milestoneInvalidTime'));
    const input: MilestoneInput = {
      id: draft.id,
      certificationId: draft.certificationId,
      kind: draft.kind,
      title: draft.title.trim(),
      plannedOn: draft.kind === 'target' || draft.allDay ? draft.plannedOn || null : null,
      plannedAt: draft.kind === 'target' ? null : plannedAt,
      completed: draft.kind === 'target' ? false : draft.completed,
    };
    try {
      validateMilestoneInput(input);
      if (await model.save(input, row?.revision ?? null)) onSaved(input);
    } catch {
      setError(labels.t('milestoneInvalidInput'));
    }
  };
  return (
    <form className="milestone-form" onSubmit={submit} aria-live="polite">
      <MilestoneFormFields
        {...draft}
        disabled={model.disabled}
        certifications={certifications}
        labels={{
          title: labels.title,
          date: labels.date,
          dateTime: labels.t('milestoneDateTime'),
          allDay: labels.t('milestoneAllDay'),
          completed: labels.completed,
          target: labels.target,
          study: labels.study,
          mock_exam: labels.mock_exam,
          exam: labels.exam,
          certification: labels.t('milestoneCertification'),
          kind: labels.t('milestoneKind'),
          timezone: labels.t('milestoneInputTimezone', { timezone }),
        }}
        onChange={(patch) => setDraft((value) => ({ ...value, ...patch }) as Draft)}
      />
      <p className="milestone-help">{labels.t('milestoneTimeHelp')}</p>
      <p className="milestone-help">{labels.t('milestoneResultHelp')}</p>
      <div className="milestone-form-actions">
        <button type="submit" disabled={model.disabled}>
          {labels.t('milestoneSave')}
        </button>
        <button type="button" onClick={onCancel}>
          {labels.t('cancel')}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
