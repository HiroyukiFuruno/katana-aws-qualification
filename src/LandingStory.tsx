import { usePreferences } from './preferences';

export function LandingHero() {
  const { locale, t } = usePreferences();
  const title = t('landingTitle');
  const emphasis = t('landingTitleEmphasis');
  const offset = title.indexOf(emphasis);
  const phraseEnd = locale === 'ja' ? title.indexOf('AWS') : title.length;
  if (offset < 0) throw new Error('Landing title must contain its emphasis');
  return (
    <section className="landing-hero">
      <div className="shell landing-hero-grid">
        <div className="landing-hero-copy">
          <span className="landing-kicker">{t('siteName')}</span>
          <h1>
            <span className={locale === 'ja' ? 'landing-title-phrase' : undefined}>
              {title.slice(0, offset)}
              <em>{emphasis}</em>
              {title.slice(offset + emphasis.length, phraseEnd)}
            </span>
            {locale === 'ja' && (
              <>
                <wbr />
                <span className="landing-title-phrase">{title.slice(phraseEnd)}</span>
              </>
            )}
          </h1>
          <p>{t('landingIntro')}</p>
          <a className="landing-read-more" href="#landing-concept-title">
            {t('landingReadMore')} <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="landing-identity" aria-hidden="true">
          <span>{t('siteShortName')}</span>
          <span className="landing-identity-mark" />
          <span>{t('landingPace')}</span>
        </div>
      </div>
    </section>
  );
}

export function LandingConcept() {
  const { t } = usePreferences();
  return (
    <section className="landing-concept" aria-labelledby="landing-concept-title">
      <div className="landing-concept-heading">
        <span className="landing-kicker" aria-hidden="true">
          {t('landingConceptLabel')}
        </span>
        <h2 id="landing-concept-title">
          <LandingSectionTitle text={t('landingConceptTitle')} />
        </h2>
      </div>
      <div className="landing-concept-copy">
        <span className="landing-concept-word" aria-hidden="true">
          {t('landingTitleEmphasis')}
        </span>
        <p>{t('landingConceptIntro')}</p>
      </div>
      <div className="landing-concept-uses">
        <h3>{t('landingUsesTitle')}</h3>
        <p>{t('landingConceptUses')}</p>
      </div>
    </section>
  );
}

export function LandingSectionTitle({ text }: { text: string }) {
  const { locale } = usePreferences();
  if (locale !== 'ja') return text;
  const phrases = text.split('、');
  return (
    <>
      {phrases.map((phrase, index) => (
        <span key={phrase} className="landing-title-phrase">
          {phrase}
          {index < phrases.length - 1 ? '、' : ''}
        </span>
      ))}
    </>
  );
}
