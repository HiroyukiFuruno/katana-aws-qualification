import { assessmentDate, assessmentEstimate, assessmentItems } from './assessment';
import { LandingCatalogStats } from './LandingCatalogStats';
import { LandingSectionTitle } from './LandingStory';
import { localePath } from './locales';
import { usePreferences } from './preferences';

const values = [
  ['landingQuickTitle', 'commuteStudyAnswer'],
  ['landingWhyTitle', 'answerExplanationsAnswer'],
  ['landingGuestTitle', 'guestStudyAnswer'],
] as const;

export function LandingValues() {
  const { t } = usePreferences();
  return (
    <section className="landing-values" aria-labelledby="landing-values-title">
      <div className="landing-section-heading">
        <span className="landing-kicker" aria-hidden="true">
          02 / VALUE
        </span>
        <h2 id="landing-values-title">
          <LandingSectionTitle text={t('landingValuesTitle')} />
        </h2>
      </div>
      <div className="landing-value-grid">
        {values.map(([title, description], index) => (
          <article key={title}>
            <span className="landing-value-number" aria-hidden="true">
              0{index + 1}
            </span>
            <h3>{t(title)}</h3>
            <p>{t(description)}</p>
          </article>
        ))}
      </div>
      <LandingCatalogStats />
    </section>
  );
}

export function LandingPaths() {
  const { locale, t } = usePreferences();
  const estimate = assessmentEstimate(assessmentItems([], assessmentDate()).length);
  return (
    <section className="landing-paths" aria-labelledby="landing-paths-title">
      <div className="landing-section-heading">
        <span className="landing-kicker" aria-hidden="true">
          04 / YOUR NEXT STEP
        </span>
        <h2 id="landing-paths-title">
          <LandingSectionTitle text={t('landingStartTitle')} />
        </h2>
      </div>
      <div className="entry-grid">
        <a className="entry-card" href={localePath(locale, 'study')}>
          <h3>{t('study')}</h3>
          <p>{t('studyPathsIntro')}</p>
          <span className="entry-action">
            {t('study')} <span aria-hidden="true">↗</span>
          </span>
        </a>
        <a className="entry-card" href={localePath(locale, 'assessment')}>
          <h3>{t('skillsAssessment')}</h3>
          <p>{t('assessmentEntry')}</p>
          {estimate.count > 0 && <small>{t('assessmentLength', estimate)}</small>}
          <span className="entry-action">
            {t('assessmentSetup')} <span aria-hidden="true">↗</span>
          </span>
        </a>
      </div>
    </section>
  );
}
