import { usePreferences } from '../preferences';

export function AccountPrivacy() {
  const { t } = usePreferences();
  return (
    <section className="card">
      <h2>{t('accountPrivacyTitle')}</h2>
      <p>{t('accountPrivacyData')}</p>
      <p>{t('accountPrivacyLearning')}</p>
      <p>{t('accountPrivacyDeletion')}</p>
    </section>
  );
}
