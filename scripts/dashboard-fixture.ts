import type { DashboardEvent, DashboardRecords } from '../src/dashboard/eventTypes';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { buildDashboardQuery } from '../src/dashboard/query';

export const base: DashboardEvent = {
  eventId: 'event-1',
  certificationId: 'saa-c03',
  questionId: 'q1',
  questionRevision: 1,
  sourceVersion: 'v1',
  category: 'security',
  mode: 'study',
  context: 'practice',
  format: 'choice-single',
  polarity: 'unspecified',
  unitId: null,
  contentVersion: null,
  answeredAt: '2026-11-19T15:00:00.000Z',
  isCorrect: true,
  durationMs: 0,
  examId: null,
  sessionId: null,
};
const events: DashboardEvent[] = [
  base,
  { ...base, eventId: 'event-2', questionId: 'q2', isCorrect: false, durationMs: 1000 },
  {
    ...base,
    eventId: 'event-3',
    questionId: 'q2',
    answeredAt: '2026-11-19T15:01:00Z',
    durationMs: 5000,
  },
  {
    ...base,
    eventId: 'event-4',
    questionId: 'q1',
    sourceVersion: 'v2',
    isCorrect: false,
    durationMs: 10000,
  },
  {
    ...base,
    eventId: 'event-5',
    questionId: 'q3',
    certificationId: 'aif-c01',
    category: 'ai',
    mode: 'exam',
    context: 'exam',
    examId: 'exam-1',
    isCorrect: false,
    durationMs: 30000,
  },
  {
    ...base,
    eventId: 'event-6',
    questionId: 'q4',
    certificationId: 'aif-c01',
    category: 'security',
    mode: 'exam',
    context: 'exam',
    examId: 'exam-1',
    durationMs: 60000,
  },
];
export const records: DashboardRecords = {
  events,
  excludedRecords: 0,
  lessonFinals: [],
  exams: [
    {
      examId: 'exam-1',
      certificationId: 'aif-c01',
      sourceVersion: 'v1',
      startedAt: null,
      submittedAt: null,
      lastAnsweredAt: base.answeredAt,
      questionCount: null,
    },
  ],
};
export const query = buildDashboardQuery(
  { ...dashboardDefaults('Asia/Tokyo').filters, period: 'all' },
  Date.parse('2026-11-20T00:00:00Z'),
);
