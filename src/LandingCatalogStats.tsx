import { usePreferences } from './preferences';

export function LandingCatalogStats() {
  const { locale, t } = usePreferences();
  const number = new Intl.NumberFormat(locale);
  const { certifications, questions } = __KAQ_CATALOG_STATS__;

  return (
    <dl className="landing-catalog-stats">
      <div>
        <dt>{t('landingCertificationsCount')}</dt>
        <dd>{number.format(certifications)}</dd>
      </div>
      <div>
        <dt>{t('landingQuestionsCount')}</dt>
        <dd>{number.format(questions)}</dd>
      </div>
    </dl>
  );
}
