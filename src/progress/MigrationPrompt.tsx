import { useMemo, useState } from 'react';
import { usePreferences } from '../preferences';
import { createQuestionResolver } from './questionCatalog';
import { importLegacy, inspectLegacy, type LegacyMigrationInput } from './migration';
import { createBrowserLegacyStorage } from './migrationBrowserStorage';

type MigrationAccess = Omit<LegacyMigrationInput, 'resolveQuestion' | 'storage'> & {
  refresh: () => Promise<void>;
};
type PromptState = 'complete' | 'failed' | 'idle' | 'importing' | 'skipped';

export function MigrationPrompt({ access }: { access: () => MigrationAccess | null }) {
  const { t } = usePreferences();
  const storage = useMemo(createBrowserLegacyStorage, []);
  const resolveQuestion = useMemo(createQuestionResolver, []);
  const [preview, setPreview] = useState(() => inspectLegacy(storage));
  const [state, setState] = useState<PromptState>('idle');
  const [rejected, setRejected] = useState(0);
  if (!preview.rows && !preview.errors && state !== 'complete' && state !== 'failed') return null;
  async function migrate() {
    const input = access();
    if (!input) {
      setState('failed');
      return;
    }
    setState('importing');
    try {
      const report = await importLegacy({ ...input, resolveQuestion, storage });
      await input.refresh();
      setRejected(report.rejected + report.failed);
      setPreview(inspectLegacy(storage));
      setState(report.failed || report.rejected || report.retained ? 'failed' : 'complete');
    } catch {
      try {
        await input.refresh();
      } catch {
        // owner切替後のstoreには触れず、元のimport失敗だけを表示する。
      }
      setState('failed');
    }
  }
  return (
    <section className="shell card layout-stack" aria-labelledby="progress-migration-title">
      <h2 id="progress-migration-title">{t('progressMigrationTitle')}</h2>
      {(preview.rows > 0 || preview.errors > 0) && (
        <p>{t('progressMigrationDescription', { count: preview.rows })}</p>
      )}
      <p className="progress-source">{t('progressAccountSource')}</p>
      {preview.errors > 0 && <p role="alert">{t('progressMigrationFailed')}</p>}
      {state === 'complete' && <p role="status">{t('progressMigrationComplete')}</p>}
      {state === 'failed' && <p role="alert">{t('progressMigrationFailed')}</p>}
      {rejected > 0 && <p role="alert">{t('progressMigrationRejected', { count: rejected })}</p>}
      {state !== 'complete' && state !== 'skipped' && (
        <div className="progress-migration-actions">
          <button type="button" disabled={state === 'importing'} onClick={() => void migrate()}>
            {state === 'importing' ? t('progressAuthLoading') : t('progressMigrationStart')}
          </button>
          <button type="button" disabled={state === 'importing'} onClick={() => setState('skipped')}>
            {t('progressMigrationSkip')}
          </button>
        </div>
      )}
      {state === 'skipped' && (
        <button type="button" onClick={() => setState('idle')}>
          {t('progressRetry')}
        </button>
      )}
    </section>
  );
}
