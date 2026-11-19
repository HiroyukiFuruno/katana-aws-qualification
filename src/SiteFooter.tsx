import { useHomePath } from './auth/AccountNavigation';
import { openCookieSettings } from './CookieConsent';
import { localePath } from './locales';
import { usePreferences } from './preferences';
import { SiteAd } from './SiteAd';

export function SiteFooter() {
  const { t, locale } = usePreferences();
  const homePath = useHomePath();
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <nav aria-label={t('footerNavigation')}>
          <a href={localePath(locale, 'study')}>{t('study')}</a>
          <a href={localePath(locale, 'assessment')}>{t('skillsAssessment')}</a>
          <a href={localePath(locale, 'certifications')}>{t('certGuides')}</a>
          <a href={localePath(locale, 'glossary')}>{t('glossary')}</a>
          <a href={localePath(locale, 'privacy')}>{t('privacy')}</a>
          <button type="button" onClick={openCookieSettings}>
            {t('cookieTitle')}
          </button>
          <a href="https://katana-series.katana-projects.org/" target="_blank" rel="noopener">
            KatanA Website
          </a>
        </nav>
        <a className="brand" href={homePath}>
          KatanA<span> AWS Qualification</span>
        </a>
      </div>
      <div className="shell">
        <SiteAd />
      </div>
    </footer>
  );
}
