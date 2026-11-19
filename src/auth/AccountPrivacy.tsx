import { localePath } from '../locales';
import { usePreferences } from '../preferences';

export function AccountPrivacy() {
  const { locale, t } = usePreferences();
  return (
    <section className="card">
      <h2>{t('accountPrivacyTitle')}</h2>
      <p>{t('accountPrivacyData')}</p>
      <p>{t('accountPrivacyLearning')}</p>
      <h3 id="account-deletion">{t('accountDeletionGuideTitle')}</h3>
      <p>{t('accountPrivacyDeletion')}</p>
      <a href={localePath(locale, 'dashboard')}>{t('accountSettings')}</a>
    </section>
  );
}
