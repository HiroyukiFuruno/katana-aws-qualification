import { AccountBenefits } from './auth/AccountBenefits';
import { LandingFaq } from './LandingFaq';
import { LandingPaths, LandingValues } from './LandingJourney';
import { LandingConcept, LandingHero } from './LandingStory';
import { usePreferences } from './preferences';
import './landing.css';

export function LandingPage() {
  const { t } = usePreferences();
  return (
    <main id="main" className="landing">
      <LandingHero />
      <div className="shell layout-stack landing-content">
        <LandingConcept />
        <LandingValues />
        <LandingPaths />
        <details className="landing-account disclosure">
          <summary>{t('accountBenefitsEyebrow')}</summary>
          <AccountBenefits context="home" />
        </details>
        <LandingFaq />
      </div>
    </main>
  );
}
