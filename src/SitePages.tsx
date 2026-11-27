import { AccountBenefits } from './auth/AccountBenefits';
import { CertificationDirectory } from './CertificationDirectory';
import { localePath } from './locales';
import { PageIntro } from './PageIntro';
import { usePreferences } from './preferences';
import { StudyEntryCards } from './StudyEntryCards';

export function NotFound() {
  const { locale, t } = usePreferences();
  return (
    <main id="main" className="shell">
      <h1>{t('pageNotFound')}</h1>
      <a href={localePath(locale)}>{t('siteName')}</a>
    </main>
  );
}

export { LandingPage as Home } from './LandingPage';

export function StudyPaths() {
  const { locale, t } = usePreferences();
  return (
    <main id="main" className="shell">
      <PageIntro>
        <div className="intro">
          <h1>{t('study')}</h1>
          <p>{t('studyPathsIntro')}</p>
        </div>
      </PageIntro>
      <StudyEntryCards locale={locale} />
      <AccountBenefits context="study" showAction />
    </main>
  );
}

export function StudyDirectory() {
  const { t } = usePreferences();
  return (
    <main id="main" className="shell study-directory">
      <PageIntro>
        <div className="intro">
          <h1>{t('learnFromQuestions')}</h1>
          <p>{t('studyEntry')}</p>
        </div>
      </PageIntro>
      <CertificationDirectory mode="study" />
    </main>
  );
}
