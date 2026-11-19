import { AccountEntryCta } from './auth/AccountEntryCta';
import { useAccount } from './auth/AuthContext';
import { LandingSectionTitle } from './LandingStory';
import { usePreferences } from './preferences';

const benefits = [
  ['landingAccountFree', 'freeStudyAnswer'],
  ['landingAccountSso', 'accountSsoOnly'],
  ['landingAccountControl', 'landingAccountControlCopy'],
] as const;

export function LandingAccount() {
  const { state } = useAccount();
  const { t } = usePreferences();
  if (state.status === 'ready' && state.account) return null;
  return (
    <section className="landing-account-pitch" aria-labelledby="landing-account-title">
      <div className="landing-account-heading">
        <span className="landing-kicker" aria-hidden="true">
          03 / ACCOUNT
        </span>
        <h2 id="landing-account-title">
          <LandingSectionTitle text={t('landingAccountTitle')} />
        </h2>
      </div>
      <ul className="landing-account-benefits">
        {benefits.map(([title, description], index) => (
          <li key={title}>
            <span className="landing-account-number" aria-hidden="true">
              0{index + 1}
            </span>
            <div>
              <h3>{t(title)}</h3>
              <p>{t(description)}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="landing-account-action">
        <AccountEntryCta />
      </div>
      <p className="landing-account-status">{t('accountBenefitsPending')}</p>
    </section>
  );
}
