import { CertificationDirectory } from './CertificationDirectory';
import { officialGuideLink } from './certificationGuides';
import { examPrices, pricingUrl } from './certificationPricing';
import { certifications, levelMessage } from './certifications';
import { localePath } from './locales';
import { PageIntro } from './PageIntro';
import { usePreferences } from './preferences';
import { useContent } from './useContent';

export function CertificationPages({ id }: { id?: string }) {
  const { locale, t } = usePreferences();
  const { content } = useContent();
  const certification = certifications.find((entry) => entry.id === id);
  const guide = certification && content.guides[certification.id];

  if (!certification || !guide) {
    return (
      <main id="main" className="shell study-directory">
        <PageIntro>
          <h1>{t('certGuides')}</h1>
        </PageIntro>
        <CertificationDirectory mode="certifications" />
      </main>
    );
  }

  const price = examPrices(certification, locale);
  const official = officialGuideLink(guide.path, locale);
  const difficulty = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    guide.difficulty,
  );
  return (
    <main id="main" className="shell">
      <PageIntro>
        <div className="intro">
          <p>
            <a href={localePath(locale, 'certifications')}>{t('backCertGuides')}</a>
          </p>
          <p className="eyebrow">
            {certification.id.toUpperCase()} · {t(levelMessage[certification.level])}
            {certification.beta ? ` · ${t('beta')}` : ''}
          </p>
          <h1>{content.certifications[certification.id].name}</h1>
        </div>
      </PageIntro>
      <section className="card">
        <h2>{t('certFee')}</h2>
        <p>
          {price.beta && (
            <>
              {t('certFeeBeta')} · <strong>{price.beta}</strong>
              <br />
              {t('certFeeStandard')} ·{' '}
            </>
          )}
          <strong>{price.standard}</strong>
          {' · '}
          <a href={pricingUrl(locale)}>{t('certPricing')}</a>
        </p>
      </section>
      <p className="cert-fee-note">
        {t('certExchangeNote', { conversion: price.conversion, rate: price.rate })}
      </p>
      <article className="card">
        <h2>{t('certScope')}</h2>
        <p>{guide.scope}</p>
        <h2>{t('certDifficulty')}</h2>
        <div
          className="difficulty-rating"
          role="img"
          aria-label={`${t('certDifficulty')} ${difficulty}/5`}
        >
          <span aria-hidden="true">★★★★★</span>
          <span
            className="difficulty-rating-fill"
            aria-hidden="true"
            style={{ width: `${guide.difficulty * 20}%` }}
          >
            ★★★★★
          </span>
        </div>
        <p>{guide.why}</p>
        <h2>{t('certAudience')}</h2>
        <p>{guide.audience}</p>
        <div className="exam-actions">
          {certification.course && (
            <a className="entry-action" href={localePath(locale, `study/${certification.id}`)}>
              {t('openCourse')}
            </a>
          )}
          <a className="entry-action" href={official.href} hrefLang={official.language}>
            {t('certOfficial')}
          </a>
        </div>
      </article>
    </main>
  );
}
