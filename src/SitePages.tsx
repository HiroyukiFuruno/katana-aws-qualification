import { AccountBenefits } from './auth/AccountBenefits';
import { AccountEntryCta } from './auth/AccountEntryCta';
import { CertificationDirectory } from './CertificationDirectory';
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
          <AccountEntryCta />
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
      <div className="shell">
        <AccountBenefits context="home" showAction />
      </div>
      <section className="shell landing-faq" aria-labelledby="landing-faq-title">
        <h2 id="landing-faq-title">{t('landingFaq')}</h2>
        <div className="card">
          <h3>{t('commuteStudyQuestion')}</h3>
          <p>{t('commuteStudyAnswer')}</p>
          <a href={localePath(locale, 'study/questions')}>{t('learnFromQuestions')}</a>
        </div>
      </section>
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
      <CertificationDirectory mode="study" />
    </main>
  );
}
