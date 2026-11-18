import { certifications } from './certifications';
import { localePath } from './locales';
import { usePreferences } from './preferences';
import { levelMessage } from './Roadmap';

const nameOrder = new Intl.Collator('en', { sensitivity: 'base' });

function examVersion(id: string) {
  return Number(id.match(/-c(\d+)$/)?.[1] ?? Infinity);
}

export function CertificationDirectory({ mode }: { mode: 'certifications' | 'study' }) {
  const { locale, t } = usePreferences();
  const visible = certifications.filter((cert) => mode === 'certifications' || cert.course);

  return Object.entries(levelMessage).map(([level, label]) => {
    const group = visible
      .filter((cert) => cert.level === level)
      .sort((a, b) => examVersion(a.id) - examVersion(b.id) || nameOrder.compare(a.name, b.name));
    if (!group.length) return null;

    return (
      <section key={label} className="certification-group" aria-labelledby={`group-${label}`}>
        <h2 id={`group-${label}`}>{t(label)}</h2>
        <ul className="course-grid">
          {group.map((cert) => (
            <li key={cert.id}>
              <a className="entry-card" href={localePath(locale, `${mode}/${cert.id}`)}>
                <small>
                  {cert.id.toUpperCase()}
                  {cert.beta ? ` · ${t('beta')}` : ''}
                </small>
                <h3>{cert.name}</h3>
                {mode === 'certifications' ? (
                  <p lang="ja">{cert.focus}</p>
                ) : (
                  <span className="entry-action">
                    {t('openCourse')} <span aria-hidden="true">→</span>
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  });
}
