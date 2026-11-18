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
          <h2>{t('study')}</h2>
          <p>{t('studyPathsIntro')}</p>
          <span className="entry-action" aria-hidden="true">
            →
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

export function StudyPaths() {
  const { locale, t } = usePreferences();
  return (
    <main id="main" className="shell">
      <div className="intro">
        <h1>{t('study')}</h1>
        <p>{t('studyPathsIntro')}</p>
      </div>
      <div className="entry-grid study-paths">
        <a className="entry-card" href={localePath(locale, 'study/fundamentals')}>
          <h2>{t('learnFundamentals')}</h2>
          <p>{t('fundamentalsEntry')}</p>
          <small>{t('coursePending')}</small>
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

const fundamentals = [
  ['fundamentalsAws', 'fundamentalsAwsDescription'],
  ['fundamentalsNetworking', 'fundamentalsNetworkingDescription'],
  ['fundamentalsDomains', 'fundamentalsDomainsDescription'],
  ['DNS', 'fundamentalsDnsDescription'],
  ['fundamentalsCidr', 'fundamentalsCidrDescription'],
  ['CI/CD', 'fundamentalsCicdDescription'],
] as const;

export function FundamentalsPage() {
  const { t } = usePreferences();
  return (
    <main id="main" className="shell">
      <div className="intro">
        <h1>{t('learnFundamentals')}</h1>
        <p>{t('fundamentalsEntry')}</p>
        <p className="eyebrow">{t('coursePending')}</p>
      </div>
      <div className="entry-grid study-paths">
        {fundamentals.map(([title, description]) => (
          <article className="entry-card" key={title}>
            <h2>{title === 'DNS' || title === 'CI/CD' ? title : t(title)}</h2>
            <p>{t(description)}</p>
          </article>
        ))}
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
      <CertificationDirectory mode="study" />
    </main>
  );
}
