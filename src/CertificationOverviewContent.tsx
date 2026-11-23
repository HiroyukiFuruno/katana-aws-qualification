import type { ReactNode } from 'react';
import type { SiteContent } from './contentTypes';
import type { Locale } from './locales';
import { localePath } from './locales';
import type { Message } from './messages';

export const certificationOverviewKeys = [
  'certOverviewTitle',
  'certOverviewSearchTitle',
  'certOverviewDescription',
  'certOverviewMeaningTitle',
  'certOverviewMeaning',
  'certOverviewChooseTitle',
  'certOverviewGoalHeader',
  'certOverviewCertificationHeader',
  'certOverviewCloudGoal',
  'certOverviewAiGoal',
  'certOverviewDesignGoal',
  'certOverviewOtherGoals',
  'certOverviewStartTitle',
  'certOverviewStartBody',
  'certOverviewOfficialLink',
  'backCertGuides',
  'certGuides',
  'learnFundamentals',
  'learnFromQuestions',
] as const;

type OverviewKey = (typeof certificationOverviewKeys)[number];
type OverviewCopy = Record<OverviewKey, string>;
type OverviewCertifications = SiteContent['certifications'];

const choices = [
  ['certOverviewCloudGoal', 'clf-c02'],
  ['certOverviewAiGoal', 'aif-c01'],
  ['certOverviewDesignGoal', 'saa-c03'],
] as const;

function certificationName(certifications: OverviewCertifications, id: string) {
  const name = certifications[id]?.name;
  if (!name) throw new Error(`Missing localized certification name: ${id}`);
  return name;
}

export function CertificationOverviewLink({
  locale,
  className,
  children,
}: {
  locale: Locale;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a className={className} href={localePath(locale, 'certifications/overview')}>
      {children}
    </a>
  );
}

export function CertificationOverviewContent({
  locale,
  copy,
  certifications,
  ad,
}: {
  locale: Locale;
  copy: OverviewCopy;
  certifications: OverviewCertifications;
  ad?: ReactNode;
}) {
  return (
    <main id="main" className="shell certification-overview">
      <p className="certification-overview-back">
        <a href={localePath(locale, 'certifications')}>{copy.backCertGuides}</a>
      </p>
      <header className="certification-overview-intro">
        <h1>{copy.certOverviewTitle}</h1>
        <p>{copy.certOverviewDescription}</p>
      </header>
      <section className="certification-overview-section" aria-labelledby="overview-meaning">
        <h2 id="overview-meaning">{copy.certOverviewMeaningTitle}</h2>
        <p>{copy.certOverviewMeaning}</p>
      </section>
      <section className="certification-overview-section" aria-labelledby="overview-choice">
        <h2 id="overview-choice">{copy.certOverviewChooseTitle}</h2>
        <div className="certification-overview-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{copy.certOverviewGoalHeader}</th>
                <th scope="col">{copy.certOverviewCertificationHeader}</th>
              </tr>
            </thead>
            <tbody>
              {choices.map(([goal, id]) => (
                <tr key={id}>
                  <td>{copy[goal]}</td>
                  <td>
                    <a href={localePath(locale, `certifications/${id}`)}>
                      {certificationName(certifications, id)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{copy.certOverviewOtherGoals}</p>
      </section>
      {ad}
      <section className="certification-overview-section" aria-labelledby="overview-start">
        <h2 id="overview-start">{copy.certOverviewStartTitle}</h2>
        <p>{copy.certOverviewStartBody}</p>
        <nav className="certification-overview-actions" aria-label={copy.certOverviewStartTitle}>
          <a className="entry-action" href={localePath(locale, 'certifications')}>
            {copy.certGuides}
          </a>
          <a className="entry-action" href={localePath(locale, 'study/fundamentals')}>
            {copy.learnFundamentals}
          </a>
          <a className="entry-action" href={localePath(locale, 'study/questions')}>
            {copy.learnFromQuestions}
          </a>
          <a className="entry-action" href="https://aws.amazon.com/certification/">
            {copy.certOverviewOfficialLink}
          </a>
        </nav>
      </section>
    </main>
  );
}

export function copyForCertificationOverview(t: (key: Message) => string): OverviewCopy {
  return Object.fromEntries(certificationOverviewKeys.map((key) => [key, t(key)])) as OverviewCopy;
}
