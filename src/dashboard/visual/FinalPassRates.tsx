import { usePreferences } from '../../preferences';
import { dashboardFinalRates } from '../finalRates';
import type { DashboardLessonFinal } from '../summaryTypes';
import type { DashboardLessonData } from '../viewTypes';
import { DashboardDataTable } from './DataTable';

export function FinalPassRates({
  sessions,
  lessons,
}: {
  sessions: readonly DashboardLessonFinal[];
  lessons: readonly DashboardLessonData[];
}) {
  const { locale, t } = usePreferences();
  if (!sessions.length) return null;
  return (
    <DashboardDataTable
      caption={t('dashboardFinalPassRate')}
      columns={[
        { id: 'unit', label: t('dashboardUnit') },
        { id: 'version', label: t('dashboardRevision') },
        { id: 'attempts', label: t('dashboardFinalAttempts'), numeric: true },
        { id: 'passed', label: t('dashboardFinalPassed'), numeric: true },
        { id: 'rate', label: t('dashboardFinalPassRate'), numeric: true },
      ]}
      rows={dashboardFinalRates(sessions).map((group) => ({
        id: group.id,
        cells: {
          unit: lessons.find((lesson) => lesson.unitId === group.unitId)?.title ?? group.unitId,
          version: group.contentVersion,
          attempts: String(group.attempts),
          passed: String(group.passed),
          rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
            group.passRate,
          ),
        },
      }))}
    />
  );
}
