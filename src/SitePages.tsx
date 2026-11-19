import { assessmentDate, assessmentEstimate, assessmentItems } from './assessment';
import { AccountBenefits } from './auth/AccountBenefits';
import { AccountEntryCta } from './auth/AccountEntryCta';
import { CertificationDirectory } from './CertificationDirectory';
import { LandingCatalogStats } from './LandingCatalogStats';
import { LandingFaq } from './LandingFaq';
import { localePath } from './locales';
import { usePreferences } from './preferences';

export function NotFound() {
  return (
    <main id="main" className="shell">
      <h1>404 — Page not found</h1>
      <a href={localePath('en')}>KatanA AWS Qualification</a>
    </main>
  );
}

function wrapJapanesePhrase(text: string, japanese: boolean, nextPhrase: string) {
  const boundary = japanese ? text.indexOf(nextPhrase) : -1;
  if (boundary < 1) return text;
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
  const estimate = assessmentEstimate(assessmentItems([], assessmentDate()).length);
  return (
    <main id="main" className="landing">
      <section className="landing-hero">
        <div className="shell layout-stack">
          <h1>{wrapJapanesePhrase(t('landingTitle'), locale === 'ja', '試験対策')}</h1>
          <p>{wrapJapanesePhrase(t('landingIntro'), locale === 'ja', 'KAQ')}</p>
          <LandingCatalogStats />
          <AccountEntryCta />
        </div>
      </section>
      <div className="shell layout-stack landing-content">
        <div className="entry-grid">
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
            {estimate.count > 0 && <small>{t('assessmentLength', estimate)}</small>}
            <span className="entry-action">
              {t('assessmentSetup')} <span aria-hidden="true">→</span>
            </span>
          </a>
        </div>
        <AccountBenefits context="home" showAction />
        <LandingFaq />
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
      <AccountBenefits context="study" showAction />
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
