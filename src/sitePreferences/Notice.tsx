import { usePreferences } from '../preferences';
import { useSitePreferences } from './context';
import './site-preferences.css';

export function SitePreferenceNotice() {
  const site = useSitePreferences();
  const { t } = usePreferences();
  if (!['load-error', 'save-error', 'conflict'].includes(site.notice)) return null;
  return (
    <section className="shell site-preference-notice" role="alert">
      <p>
        {t(
          site.notice === 'conflict'
            ? 'sitePreferencesConflict'
            : site.notice === 'load-error'
              ? 'sitePreferencesLoadFailed'
              : 'sitePreferencesSaveFailed',
        )}
      </p>
      <button type="button" disabled={site.loading} onClick={site.reload}>
        {t('sitePreferencesReload')}
      </button>
    </section>
  );
}
