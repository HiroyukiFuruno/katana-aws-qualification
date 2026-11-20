import type { usePreferences } from './preferences';

type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamResultsButton({
  disabled,
  onClick,
  t,
}: {
  disabled: boolean;
  onClick: () => void;
  t: Translate;
}) {
  return (
    <p className="exam-actions">
      <button type="button" onClick={onClick} disabled={disabled}>
        {t('viewResults')}
      </button>
    </p>
  );
}
