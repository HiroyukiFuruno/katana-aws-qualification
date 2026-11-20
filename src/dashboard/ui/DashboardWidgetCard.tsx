import type { ReactNode } from 'react';
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
}: {
  widget: DashboardWidget;
  state: DashboardDataState;
  lessons: DashboardViewProps['lessons'];
  controls?: ReactNode;
}) {
  const { t } = usePreferences();
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
