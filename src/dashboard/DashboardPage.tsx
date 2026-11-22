import { PageIntro } from '../PageIntro';
import { usePreferences } from '../preferences';
import { useProgress } from '../progress/ProgressProvider';
import type { ProgressStore } from '../progress/storeTypes';
import { DashboardOwner } from './DashboardOwner';

const storeIds = new WeakMap<ProgressStore, number>();
let nextStoreId = 0;
function storeId(store: ProgressStore) {
  if (!storeIds.has(store)) storeIds.set(store, ++nextStoreId);
  return storeIds.get(store);
}

export function DashboardPage() {
  const progress = useProgress();
  const { t } = usePreferences();
  return progress.status !== 'ready' || !progress.store ? (
    <main id="main" className="shell account-page">
      <PageIntro>
        <h1>{t('accountDashboard')}</h1>
      </PageIntro>
      <p role={progress.status === 'error' ? 'alert' : 'status'}>
        {t(progress.status === 'error' ? 'dashboardError' : 'accountLoading')}
      </p>
      <button type="button" onClick={() => void progress.retry()}>
        {t('progressRetry')}
      </button>
    </main>
  ) : (
    <DashboardOwner key={storeId(progress.store)} store={progress.store} />
  );
}
