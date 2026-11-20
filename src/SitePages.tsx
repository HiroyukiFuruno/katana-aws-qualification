import { AccountBenefits } from './auth/AccountBenefits';
import { CertificationDirectory } from './CertificationDirectory';
import { localePath } from './locales';
import { usePreferences } from './preferences';
import { SiteAd } from './SiteAd';

export function NotFound() {
  return (
    <main id="main" className="shell">
      <h1>404 — Page not found</h1>
      <a href={localePath('en')}>KatanA AWS Qualification</a>
    </main>
  );
}

export { LandingPage as Home } from './LandingPage';

export function StudyPaths() {
  const { locale, t } = usePreferences();
  return (
    <main id="main" className="shell">
      <div className="intro">
        <h1>{t('study')}</h1>
        <p>{t('studyPathsIntro')}</p>
      </div>
      <AccountBenefits context="study" showAction />
      <SiteAd placement="inline" />
      <div className="entry-grid study-paths">
        <a className="entry-card" href={localePath(locale, 'study/fundamentals')}>
          <h2>{t('learnFundamentals')}</h2>
          <p>{t('fundamentalsEntry')}</p>
          <span className="entry-action">
            {t('learnFundamentals')} <span aria-hidden="true">→</span>
          </span>
        </a>
        <a className="entry-card" href={localePath(locale, 'study/questions')}>
          <h2>{t('learnFromQuestions')}</h2>
          <p>{t('studyEntry')}</p>
          <span className="entry-action">
            {t('browseCourses')} <span aria-hidden="true">→</span>
          </span>
        </a>
      </div>
    </main>
  );
}

export function StudyDirectory() {
  const { t } = usePreferences();
  return (
    <main id="main" className="shell study-directory">
      <div className="intro">
        <h1>{t('learnFromQuestions')}</h1>
        <p>{t('studyEntry')}</p>
      </div>
      <SiteAd placement="inline" />
      <CertificationDirectory mode="study" />
    </main>
  );
}
