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
          <img src="/katana-icon-128.png" width="40" height="40" alt="" />
          <span className="brand-name">
            KatanA <span>AWS Qualification</span>
          </span>
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

function wrapJapanesePhrase(text: string, japanese: boolean) {
  const boundary = japanese ? text.indexOf('、') + 1 : 0;
  if (!boundary) return text;
  return (
    <>
      {text.slice(0, boundary)}
      <wbr />
      {text.slice(boundary)}
    </>
  );
}

export function Home() {
  const { locale, t } = usePreferences();
  return (
    <main id="main" className="landing">
      <section className="landing-hero">
        <div className="shell">
          <h1>{wrapJapanesePhrase(t('landingTitle'), locale === 'ja')}</h1>
          <p>{wrapJapanesePhrase(t('landingIntro'), locale === 'ja')}</p>
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
