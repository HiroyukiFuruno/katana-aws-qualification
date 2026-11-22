import type { ReactNode } from 'react';
import { MilestonesPanel, type MilestonesPanelProps } from '../../milestones/MilestonesPanel';
import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardDataState, DashboardViewProps } from '../viewTypes';
import { DashboardWidgetState } from './DashboardWidgetState';
import { titleKeys } from './dashboardLabels';

export function DashboardWidgetCard({
  widget,
  state,
  lessons,
  controls,
  planning,
}: {
  widget: DashboardWidget;
  state: DashboardDataState;
  lessons: DashboardViewProps['lessons'];
  controls?: ReactNode;
  planning?: Pick<MilestonesPanelProps, 'model' | 'timezone' | 'certificationIds'>;
}) {
  const { t } = usePreferences();
  if (widget.kind === 'milestones') {
    if (!planning) throw new Error('Milestone widget configuration is missing.');
    return (
      <section
        className={`dashboard-widget dashboard-widget-${widget.width} dashboard-widget-kind-milestones`}
        aria-label={t('dashboardMilestones')}
      >
        {controls}
        <MilestonesPanel
          {...planning}
          chart={widget.chart === 'calendar' ? 'calendar' : 'table'}
          id={`dashboard-widget-${widget.id}`}
        />
      </section>
    );
  }
  return (
    <section
      className={`card dashboard-widget dashboard-widget-${widget.width} dashboard-widget-kind-${widget.kind}`}
      aria-labelledby={`dashboard-widget-${widget.id}`}
    >
      <div className="dashboard-widget-heading">
        <h2 id={`dashboard-widget-${widget.id}`}>{t(titleKeys[widget.kind])}</h2>
        {controls}
        {Object.keys(widget.overrides).length > 0 && (
          <span className="eyebrow">{t('dashboardOverrideCustom')}</span>
        )}
      </div>
      <DashboardWidgetState key={widget.id} state={state} widget={widget} lessons={lessons} t={t} />
    </section>
  );
}
