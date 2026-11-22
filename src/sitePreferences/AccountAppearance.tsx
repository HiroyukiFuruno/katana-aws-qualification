import { certifications } from '../certifications';
import localeNames from '../locale-names.json' with { type: 'json' };
import { localePath, locales } from '../locales';
import { usePreferences } from '../preferences';
import { ProgressGate } from '../progress/ProgressGate';
import { useContent } from '../useContent';
import { useRoadmapProfile } from '../useRoadmapProfile';
import { useSitePreferences } from './context';
import { defaultSitePreferences } from './repository';
import './site-preferences.css';

function EarnedQualifications() {
  const { profile } = useRoadmapProfile();
  const { content } = useContent();
  const { locale, t } = usePreferences();
  const earned = certifications.filter((certification) => profile.earned.includes(certification.id));
  return (
    <section className="card layout-stack">
      <h2>{t('accountCertifications')}</h2>
      {earned.length ? (
        <ul>
          {earned.map((certification) => (
            <li key={certification.id}>
              {content.certifications[certification.id]?.name ?? t('loadContentError')}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('accountNoCertifications')}</p>
      )}
      <a href={localePath(locale, 'assessment')}>{t('accountManageCertifications')}</a>
    </section>
  );
}

export function AccountAppearance() {
  const site = useSitePreferences();
  const { changeLocale, themeChoice, changeTheme, t } = usePreferences();
  if (site.kind !== 'member') return null;
  return (
    <>
      <section className="card layout-stack" aria-labelledby="account-appearance-title">
        <h2 id="account-appearance-title">{t('sitePreferencesTitle')}</h2>
        <p>{t('sitePreferencesScope')}</p>
        {site.loading && <p role="status">{t('accountLoading')}</p>}
        <div className="site-preference-fields">
          <label htmlFor="account-default-locale">
            {t('siteDefaultLanguage')}
            <select
              id="account-default-locale"
              disabled={site.disabled}
              value={site.values.locale ?? ''}
              onChange={(event) => {
                if (event.currentTarget.value === '') {
                  site.save({ ...site.values, locale: null });
                  return;
                }
                const next = locales.find((candidate) => candidate === event.currentTarget.value);
                if (next) changeLocale(next);
              }}
            >
              <option value="">{t('siteLanguageDefault')}</option>
              {locales.map((value) => (
                <option key={value} value={value} lang={value}>
                  {localeNames[value]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="account-theme">
            {t('siteTheme')}
            <select
              id="account-theme"
              disabled={site.disabled}
              value={themeChoice ?? 'system'}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (next === 'light' || next === 'dark' || next === 'system')
                  changeTheme(next === 'system' ? null : next);
              }}
            >
              <option value="system">{t('siteThemeSystem')}</option>
              <option value="light">{t('siteThemeLight')}</option>
              <option value="dark">{t('siteThemeDark')}</option>
            </select>
          </label>
        </div>
        {site.notice === 'saving' && <p role="status">{t('sitePreferencesSaving')}</p>}
        {site.notice === 'saved' && <p role="status">{t('sitePreferencesSaved')}</p>}
        <p>{t('sitePreferencesResetScope')}</p>
        <button type="button" disabled={site.disabled} onClick={() => site.save(defaultSitePreferences)}>
          {t('sitePreferencesReset')}
        </button>
      </section>
      <ProgressGate>
        <EarnedQualifications />
      </ProgressGate>
    </>
  );
}
