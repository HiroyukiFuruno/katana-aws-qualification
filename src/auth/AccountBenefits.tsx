import { useId } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';

type AccountBenefitContext = 'home' | 'study' | 'exam' | 'assessment';

export function AccountBenefits({
  context = 'home',
  showAction = false,
}: {
  context?: AccountBenefitContext;
  showAction?: boolean;
}) {
  const { state } = useAccount();
  const { locale, t } = usePreferences();
  const heading = useId();
  const guest = state.status === 'ready' && state.account === null;
  const contextLabel = t(
    context === 'assessment'
      ? 'skillsAssessment'
      : context === 'exam'
        ? 'exam'
        : context === 'study'
          ? 'study'
          : 'accountBenefitsContextHome',
  );
  if (showAction && state.account) return null;
  return (
    <section className="account-benefits" aria-labelledby={heading}>
      <p className="eyebrow">{t('accountBenefitsEyebrow')}</p>
      <h2 id={heading}>{t('accountBenefitsTitle')}</h2>
      <p>{t('accountBenefitsContext', { context: contextLabel })}</p>
      <ul>
        <li>{t('accountBenefitProgress')}</li>
        <li>{t('accountBenefitSync')}</li>
        <li>{t('accountBenefitFree')}</li>
      </ul>
      <p className="account-benefits-note">{t('accountBenefitsPending')}</p>
      {guest && showAction && (
        <a className="primary account-benefits-action" href={localePath(locale, 'login')}>
          {t('accountCreateCta')}
        </a>
      )}
    </section>
  );
}
