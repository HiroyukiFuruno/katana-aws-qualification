// 004より前の003 validatorに保存できる、schema 1の履歴fixtureを固定する。
export const foundationDashboardSettings = {
  schemaVersion: 1,
  filters: {
    period: '90d',
    timezone: 'Asia/Tokyo',
    certificationIds: ['saa-c03'],
    categories: ['security'],
    modes: ['study', 'exam'],
    contexts: ['practice', 'exam'],
    formats: ['choice-single'],
    polarities: ['correct'],
    revisions: [{ sourceVersion: 'migration-fixture-v1', questionRevision: 1 }],
    unitIds: ['fundamentals.cloud-concepts'],
  },
  widgets: [
    {
      id: 'foundation-overview',
      kind: 'overview',
      visible: true,
      width: 'normal',
      chart: 'metrics',
      metric: 'answered',
      dimension: 'default',
      overrides: { period: '7d', certificationIds: null },
    },
    {
      id: 'foundation-trend',
      kind: 'trend',
      visible: false,
      width: 'wide',
      chart: 'area',
      metric: 'accuracy',
      dimension: 'default',
      overrides: { period: 'all', timezone: 'America/New_York', modes: ['review'] },
    },
  ],
} as const;
