import { CertificationDirectory } from './CertificationDirectory';
import { usePreferences } from './preferences';

export function RoadmapSetup({
  earned,
  hasRemaining,
  complete,
  estimate,
  onToggle,
  onStart,
  saving,
}: {
  earned: string[];
  hasRemaining: boolean;
  complete: boolean;
  estimate: { count: number; minutes: number };
  onToggle: (id: string, checked: boolean) => void;
  onStart: () => void;
  saving: boolean;
}) {
  const { t } = usePreferences();
  return (
    <section className="card roadmap-card">
      <h2>{t('earned')}</h2>
      <p>{t('earnedIntro')}</p>
      <CertificationDirectory mode="earned" selected={earned} saving={saving} onToggle={onToggle} />
      {hasRemaining ? (
        <button type="button" className="primary" disabled={saving} onClick={onStart}>
          {complete ? t('certOrder') : t('startAssessment', estimate)}
        </button>
      ) : (
        <p role="status">{t('allEarned')}</p>
      )}
    </section>
  );
}
