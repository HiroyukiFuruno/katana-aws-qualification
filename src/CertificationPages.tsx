import { certificationGuides } from './certificationGuides';
import { certifications } from './certifications';
import { localePath } from './locales';
import { usePreferences } from './preferences';
import { levelMessage } from './Roadmap';

export function CertificationPages({ id }: { id?: string }) {
  const { locale, t } = usePreferences();
  const certification = certifications.find((entry) => entry.id === id);
  const guide = certification && certificationGuides[certification.id];

  if (!certification || !guide) {
    return (
      <main id="main" className="shell study-directory">
        <h1>{t('certGuides')}</h1>
        <ul className="course-grid">
          {certifications.map((entry) => (
            <li key={entry.id}>
              <a className="entry-card" href={localePath(locale, `certifications/${entry.id}`)}>
                <small>
                  {entry.id.toUpperCase()} · {t(levelMessage[entry.level])}
                </small>
                <h2>{entry.name}</h2>
                <p lang="ja">{entry.focus}</p>
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main id="main" className="shell">
      <div className="intro">
        <p>
          <a href={localePath(locale, 'certifications')}>{t('backCertGuides')}</a>
        </p>
        <p className="eyebrow">
          {certification.id.toUpperCase()} · {t(levelMessage[certification.level])}
          {certification.beta ? ` · ${t('beta')}` : ''}
        </p>
        <h1>{certification.name}</h1>
      </div>
      <article className="card">
        <h2>{t('certScope')}</h2>
        <p lang="ja">{guide.scope}</p>
        <h2>
          {t('certDifficulty')} · {guide.difficulty}/5
        </h2>
        <p lang="ja">{guide.why}</p>
        <h2>{t('certAudience')}</h2>
        <p lang="ja">{guide.audience}</p>
        <div className="exam-actions">
          {certification.course && (
            <a className="entry-action" href={localePath(locale, `study/${certification.id}`)}>
              {t('openCourse')}
            </a>
          )}
          <a
            className="entry-action"
            href={`https://docs.aws.amazon.com/aws-certification/latest/${guide.path}.html`}
          >
            {t('certOfficial')}
          </a>
        </div>
      </article>
    </main>
  );
}
