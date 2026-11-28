import { certifications, levelMessage, studyCourses } from './certifications';
import { localePath } from './locales';
import { usePreferences } from './preferences';
import { qualificationLearningPath } from './qualificationLearning/routes';
import { useContent } from './useContent';

type DirectoryProps =
  | { mode: 'certifications' | 'study' }
  | {
      mode: 'earned';
      selected: string[];
      saving: boolean;
      onToggle: (id: string, checked: boolean) => void;
    };

const nameOrder = new Intl.Collator('en', { sensitivity: 'base' });

function examVersion(id: string) {
  return Number(id.match(/-c(\d+)$/)?.[1] ?? Infinity);
}

export function CertificationDirectory(props: DirectoryProps) {
  const { locale, t } = usePreferences();
  const { content } = useContent();
  const { mode } = props;
  const Heading = mode === 'earned' ? 'h3' : 'h2';
  const visible = mode === 'study' ? studyCourses : certifications;

  return (
    <div
      className={
        mode === 'earned' ? 'certification-directory earned-directory' : 'certification-directory'
      }
    >
      {Object.entries(levelMessage).map(([level, label]) => {
        const group = visible
          .filter((cert) => cert.level === level)
          .sort((a, b) => examVersion(a.id) - examVersion(b.id) || nameOrder.compare(a.name, b.name));
        if (!group.length) return null;

        return (
          <section key={label} className="certification-group" aria-labelledby={`group-${label}`}>
            <Heading id={`group-${label}`} className="certification-group-title">
              {t(label)}
            </Heading>
            <ul className="course-grid">
              {group.map((cert) => {
                const code = (
                  <small className="certification-code">
                    {cert.id.toUpperCase()}
                    {cert.beta ? ` · ${t('beta')}` : ''}
                  </small>
                );
                return (
                  <li key={cert.id}>
                    {props.mode === 'earned' ? (
                      <label className="certification-row cert-check">
                        <input
                          type="checkbox"
                          checked={props.selected.includes(cert.id)}
                          disabled={props.saving}
                          onChange={(event) => props.onToggle(cert.id, event.currentTarget.checked)}
                        />
                        <span className="certification-row-content">
                          <strong>{content.certifications[cert.id].name}</strong>
                          {code}
                        </span>
                      </label>
                    ) : (
                      <a
                        className="certification-row"
                        href={
                          (mode === 'study' ? qualificationLearningPath(locale, cert.id) : undefined) ??
                          localePath(locale, `${mode}/${cert.id}`)
                        }
                      >
                        <div className="certification-row-content">
                          {code}
                          <h3>{content.certifications[cert.id].name}</h3>
                          {mode === 'certifications' && <p>{content.certifications[cert.id].focus}</p>}
                        </div>
                        <span aria-hidden="true" className="certification-row-arrow">
                          →
                        </span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
