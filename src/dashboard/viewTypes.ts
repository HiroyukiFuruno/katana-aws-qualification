import type { LessonSummary } from '../fundamentals/state/memberTypes';
import type { MilestoneApi } from '../milestones/modelTypes';
import type { DashboardPreferences, DashboardWidget } from './preferenceTypes';
import type { DashboardSummary } from './summaryTypes';

export type DashboardDataState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; summary: DashboardSummary; excludedRecords: number; retry: () => void };

export type DashboardLessonData = {
  unitId: string;
  title: string;
  href: string;
  summary: LessonSummary;
};

export type DashboardViewProps = {
  milestoneApi?: MilestoneApi | null;
  storageControl?: ReactNode;
  owner: 'guest' | 'member';
  consented: boolean;
  preferences: DashboardPreferences;
  dirty: boolean;
  saving: boolean;
  saveState: 'idle' | 'saved' | 'error' | 'conflict' | 'invalid-stored';
  pendingLearning: boolean;
  syncUnreadable?: boolean;
  data: ReadonlyMap<string, DashboardDataState>;
  lessons: { status: 'loading' | 'ready' | 'error'; items: DashboardLessonData[] };
  onPreferences: (preferences: DashboardPreferences) => void;
  onApply: () => void;
  onSave: () => void;
  onReloadSettings: () => void;
  onReset: () => void;
  onConsent: () => void;
  onRefresh: () => void;
};

export type DashboardWidgetViewProps = {
  widget: DashboardWidget;
  data: DashboardDataState;
  lessons: DashboardViewProps['lessons'];
};

import type { ReactNode } from 'react';
