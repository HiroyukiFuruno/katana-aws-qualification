import { useState } from 'react';
import type { ExamBlueprint } from './certifications';
import { examDurationMinutes, examPresetCounts } from './exam';
import { usePreferences } from './preferences';

const labels = {
  short: 'examFormatShort',
  medium: 'examFormatMedium',
  full: 'examFormatFull',
  custom: 'examFormatCustom',
} as const;

type Format = keyof typeof labels;
const formats = ['short', 'medium', 'full', 'custom'] as const;

export function ExamFormatPicker({
  blueprint,
  available,
  onStart,
  buttonLabel,
}: {
  blueprint: ExamBlueprint;
  available: boolean;
  onStart: (count: number) => void;
  buttonLabel: string;
}) {
  const { t } = usePreferences();
  const presets = examPresetCounts(blueprint);
  const [format, setFormat] = useState<Format>('full');
  const [custom, setCustom] = useState(String(presets.medium));
  const customCount = Number(custom);
  const validCustom = Number.isInteger(customCount) && customCount >= 1 && customCount <= presets.full;
  const count = format === 'custom' ? customCount : presets[format];
  const canStart = available && (format !== 'custom' || validCustom);

  return (
    <form
      className="question-set-picker exam-format-picker"
      onSubmit={(event) => {
        event.preventDefault();
        if (canStart) onStart(count);
      }}
    >
      <label>
        {t('examFormat')}
        <select
          value={format}
          onChange={(event) => {
            const next = formats.find((option) => option === event.target.value);
            if (next) setFormat(next);
          }}
        >
          {formats.map((option) => {
            const length = option === 'custom' ? customCount : presets[option];
            const details =
              option === 'custom' && !validCustom
                ? t('examCustomRange', { count: presets.full })
                : t('examLength', { count: length, minutes: examDurationMinutes(blueprint, length) });
            return (
              <option key={option} value={option}>
                {t(labels[option])} ({details})
              </option>
            );
          })}
        </select>
      </label>
      {format === 'custom' && (
        <label>
          {t('questions')}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={presets.full}
            step={1}
            required
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
        </label>
      )}
      <button type="submit" className="primary" disabled={!canStart}>
        {buttonLabel}
      </button>
    </form>
  );
}
