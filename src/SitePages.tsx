import { CertificationDirectory } from './CertificationDirectory';
import { localePath } from './locales';
import { SiteControls, usePreferences } from './preferences';

export function SiteHeader({ section }: { section: string }) {
  const { locale, t } = usePreferences();
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <div className="shell topbar">
        <a className="brand" href={localePath(locale)}>
          KatanA<span> AWS Qualification</span>
        </a>
        <nav className="site-navigation" aria-label={t('navigation')}>
          <a
            href={localePath(locale, 'study')}
            aria-current={section === 'study' ? 'location' : undefined}
          >
            {t('study')}
          </a>
          <a
            href={localePath(locale, 'assessment')}
            aria-current={section === 'assessment' ? 'page' : undefined}
          >
            {t('skillsAssessment')}
          </a>
          <a
            href={localePath(locale, 'certifications')}
            aria-current={section === 'certifications' ? 'location' : undefined}
          >
            {t('certGuides')}
          </a>
          <a
            href={localePath(locale, 'glossary')}
            aria-current={section === 'glossary' ? 'page' : undefined}
          >
            {t('glossary')}
          </a>
        </nav>
        <SiteControls />
      </div>
    </header>
  );
}

export function NotFound() {
  return (
    <main id="main" className="shell">
      <h1>404 — Page not found</h1>
      <a href={localePath('en')}>KatanA AWS Qualification</a>
    </main>
  );
}

export function Home() {
  const { locale, t } = usePreferences();
  const title = t('landingTitle');
  const phraseBoundary = locale === 'ja' ? title.indexOf('、') + 1 : 0;
  return (
    <main id="main" className="landing">
      <section className="landing-hero">
        <div className="shell">
          <h1>
            {phraseBoundary > 0 ? (
              <>
                {title.slice(0, phraseBoundary)}
                <wbr />
                {title.slice(phraseBoundary)}
              </>
            ) : (
              title
            )}
          </h1>
          <p>{t('landingIntro')}</p>
        </div>
      </section>
      <div className="shell entry-grid">
        <a className="entry-card" href={localePath(locale, 'study')}>
          <h2>{t('chooseCourse')}</h2>
          <p>{t('studyEntry')}</p>
          <span className="entry-action">
            {t('browseCourses')} <span aria-hidden="true">→</span>
          </span>
        </a>
        <a className="entry-card" href={localePath(locale, 'assessment')}>
          <h2>{t('skillsAssessment')}</h2>
          <p>{t('assessmentEntry')}</p>
          <span className="entry-action">
            {t('assessmentSetup')} <span aria-hidden="true">→</span>
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
        <h1>{t('chooseCourse')}</h1>
        <p>{t('studyEntry')}</p>
      </div>
      <CertificationDirectory mode="study" />
    </main>
  );
}
