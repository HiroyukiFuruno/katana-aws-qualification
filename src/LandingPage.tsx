import { AccountBenefits } from './auth/AccountBenefits';
import { LandingAccount } from './LandingAccount';
import { LandingFaq } from './LandingFaq';
import { LandingPaths, LandingValues } from './LandingJourney';
import { LandingConcept, LandingHero } from './LandingStory';
import { usePreferences } from './preferences';
import { SiteAd } from './SiteAd';
import './landing.css';

export function LandingPage() {
  const { t } = usePreferences();
  return (
    <main id="main" className="landing">
      <LandingHero />
      <div className="shell layout-stack landing-content">
        <SiteAd placement="inline" />
        <LandingConcept />
        <LandingValues />
        <LandingAccount />
        <LandingPaths />
        <SiteAd placement="inline" />
        <details className="landing-account disclosure">
          <summary>{t('accountPrivacyTitle')}</summary>
          <AccountBenefits context="home" />
        </details>
        <LandingFaq />
      </div>
    </main>
  );
}
