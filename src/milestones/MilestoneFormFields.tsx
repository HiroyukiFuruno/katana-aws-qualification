import type { ChangeEvent } from 'react';
import { kindKeys } from './labels';
import type { MilestoneKind } from './types';

type Props = {
  title: string;
  certificationId: string;
  kind: MilestoneKind;
  plannedOn: string;
  plannedAt: string;
  allDay: boolean;
  completed: boolean;
  certifications: readonly { id: string; name: string }[];
  disabled: boolean;
  labels: Record<string, string>;
  onChange: (patch: Partial<Props>) => void;
};

export function MilestoneFormFields({
  title,
  certificationId,
  kind,
  plannedOn,
  plannedAt,
  allDay,
  completed,
  certifications,
  labels,
  onChange,
  disabled,
}: Props) {
  const update = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value =
      event.currentTarget.type === 'checkbox'
        ? (event.currentTarget as HTMLInputElement).checked
        : event.currentTarget.value;
    if (event.currentTarget.name === 'allDay')
      return onChange(value ? { allDay: true, plannedAt: '' } : { allDay: false, plannedOn: '' });
    if (event.currentTarget.name === 'kind' && value === 'target')
      return onChange({ kind: 'target', allDay: true, plannedAt: '', completed: false });
    onChange({ [event.currentTarget.name]: value });
  };
  return (
    <fieldset className="milestone-form-fields" disabled={disabled}>
      <label>
        {labels.title}
        <input name="title" value={title} onChange={update} maxLength={120} required />
      </label>
      <label>
        {labels.certification}
        <select name="certificationId" value={certificationId} onChange={update} required>
          {certifications.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {labels.kind}
        <select name="kind" value={kind} onChange={update}>
          {kindKeys.map((key) => (
            <option key={key} value={key}>
              {labels[key]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {labels.date}
        <input name="plannedOn" type="date" value={plannedOn} onChange={update} disabled={!allDay} />
      </label>
      {kind !== 'target' && (
        <label>
          {labels.dateTime}
          <input
            name="plannedAt"
            type="datetime-local"
            value={plannedAt}
            onChange={update}
            disabled={allDay}
          />
        </label>
      )}
      {kind !== 'target' && (
        <label>
          <input name="allDay" type="checkbox" checked={allDay} onChange={update} />
          {labels.allDay}
        </label>
      )}
      <p className="milestone-help">{labels.timezone}</p>
      {kind !== 'target' && (
        <label>
          <input name="completed" type="checkbox" checked={completed} onChange={update} />
          {labels.completed}
        </label>
      )}
    </fieldset>
  );
}
