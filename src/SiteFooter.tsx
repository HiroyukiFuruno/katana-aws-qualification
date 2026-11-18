import { localePath } from './locales';
import { usePreferences } from './preferences';

export function SiteFooter() {
  const { t, locale } = usePreferences();
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <a className="brand" href={localePath(locale)}>
            KatanA<span> AWS Qualification</span>
          </a>
          <a href={`https://katana-series.katana-projects.org${localePath(locale)}`}>{t('series')}</a>
        </div>
        <nav aria-label={t('footerNavigation')}>
          <a href={localePath(locale, 'study')}>{t('study')}</a>
          <a href={localePath(locale, 'assessment')}>{t('skillsAssessment')}</a>
          <a href={localePath(locale, 'certifications')}>{t('certGuides')}</a>
        </nav>
      </div>
    </footer>
  );
}
