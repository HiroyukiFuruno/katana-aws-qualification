import type { Message } from './messages';
import type { usePreferences } from './preferences';

type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamSaveError({
  busy,
  error,
  onReload,
  t,
}: {
  busy: boolean;
  error: Message | '';
  onReload: () => void;
  t: Translate;
}) {
  if (!error) return null;
  return (
    <div className="notice">
      <p role="alert">{t(error)}</p>
      <button type="button" disabled={busy} onClick={onReload}>
        {t('examReloadSaved')}
      </button>
    </div>
  );
}
