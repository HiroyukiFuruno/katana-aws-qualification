import { useRef, useState } from 'react';
import { usePreferences } from './preferences';

export function CourseSettings({
  count,
  onReset,
  onExport,
}: {
  count: number;
  onReset: () => Promise<void>;
  onExport: () => void;
}) {
  const { t } = usePreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  async function confirmReset() {
    setBusy(true);
    dialog.current?.close();
    try {
      await onReset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>{t('learningData')}</h2>
      <p>{t('savedAnswers', { count })}</p>
      <button type="button" className="primary" disabled={!count || busy} onClick={onExport}>
        {t('export')}
      </button>
      <hr />
      <h3>{t('resetTitle')}</h3>
      <p>{t('resetDescription')}</p>
      <button
        type="button"
        className="danger"
        disabled={busy}
        onClick={() => dialog.current?.showModal()}
      >
        {t('reset')}
      </button>
      <dialog ref={dialog} aria-labelledby="reset-title">
        <h2 id="reset-title">{t('confirmReset')}</h2>
        <p>{t('resetWarning')}</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            {t('cancel')}
          </button>
          <button type="button" className="danger" onClick={() => void confirmReset()}>
            {t('delete')}
          </button>
        </div>
      </dialog>
    </section>
  );
}
