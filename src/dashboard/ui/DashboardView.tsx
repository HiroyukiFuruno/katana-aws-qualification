import type { ReactNode } from 'react';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import type { DashboardViewProps } from '../viewTypes';
import { dashboardDisplayFacets } from './dashboardDisplayFacets';
import { DashboardControls } from './DashboardControls';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import './dashboard.css';

export function DashboardView(props: DashboardViewProps) {
  const { locale, t } = usePreferences();
  const visible = props.preferences.widgets.filter((widget) => widget.visible);
  const ready = [...props.data.values()].find((state) => state.status === 'ready');
  const facets = dashboardDisplayFacets(
    ready?.status === 'ready' ? ready.summary.facets : undefined,
    props.lessons.items,
  );
  const allowed = props.owner === 'member' || props.consented;
  const controls = <DashboardControls key="controls" {...props} facets={facets} />;
  const cards: ReactNode[] = [];
  for (const widget of visible) {
    cards.push(
      <DashboardWidgetCard
        key={`widget:${widget.id}`}
        widget={widget}
        state={props.data.get(widget.id) ?? { status: 'loading' }}
        lessons={props.lessons}
        preferences={props.preferences}
        onPreferences={props.onPreferences}
        facets={facets}
      />,
    );
  }
  return (
    <main id="main" className="shell dashboard-page">
      <header className="dashboard-heading">
        <p className="eyebrow">{t('progress')}</p>
        <h1>{t('dashboardTitle')}</h1>
        <div className="dashboard-identity-row">
          <p className="dashboard-source">
            {props.owner === 'member' ? t('progressAccountSource') : t('progressGuestSource')}
          </p>
          {props.owner === 'guest' && <a href={localePath(locale, 'login')}>{t('accountCreateCta')}</a>}
        </div>
      </header>
      {!props.consented && props.owner === 'guest' && (
        <section className="notice dashboard-consent">
          <p>{t('dashboardConsent')}</p>
          {!props.storageControl && (
            <button type="button" onClick={props.onConsent}>
              {t('progressStorageAllow')}
            </button>
          )}
        </section>
      )}
      <div className="dashboard-toolbar">
        {props.storageControl}
        {allowed && controls}
      </div>
      {allowed && props.pendingLearning && (
        <p className="notice" role="status">
          {t('dashboardPending')}{' '}
          <a href={localePath(locale, 'study/fundamentals')}>{t('dashboardPendingReview')}</a>
        </p>
      )}
      {allowed && props.syncUnreadable && (
        <p className="notice" role="alert">
          {t('dashboardPendingReadFailed')}
        </p>
      )}
      {allowed && props.dirty && (
        <p className="notice" role="status">
          {t('dashboardUnsaved')}
        </p>
      )}
      {allowed && <div className="dashboard-grid">{cards}</div>}
      {props.owner === 'guest' && props.consented && (
        <aside className="card dashboard-account-pitch">
          <div>
            <p className="eyebrow">{t('accountBenefitsEyebrow')}</p>
            <h2>{t('accountBenefitsTitle')}</h2>
            <p>{t('accountBenefitSync')}</p>
          </div>
          <a className="primary" href={localePath(locale, 'login')}>
            {t('accountCreateCta')}
          </a>
        </aside>
      )}
    </main>
  );
}
