import { usePreferences } from './preferences';

export function RoadmapHeader({
  showEstimate,
  estimate,
}: {
  showEstimate: boolean;
  estimate: { count: number; minutes: number };
}) {
  const { t } = usePreferences();
  return (
    <div className="intro">
      <h1>{t('skillsAssessment')}</h1>
      <p>{t('roadmapIntro')}</p>
      {showEstimate && (
        <p>
          <output>
            <strong>{t('assessmentDuration', estimate)}</strong>
          </output>
        </p>
      )}
    </div>
  );
}
