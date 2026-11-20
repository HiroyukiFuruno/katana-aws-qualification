import { timestamp, uuid } from '../fundamentals/state/codecPrimitives';
import { dashboardNumber, dashboardRecord, dashboardText } from './codec';
import { assertDashboardSum, dashboardRows, readDashboardStats } from './summaryStatsCodec';
import type { DashboardExam, DashboardLessonFinal } from './summaryTypes';

const nullableTime = (value: unknown) =>
  value === null ? null : timestamp(value, 'dashboard session time');
export function readDashboardExams(value: unknown): DashboardExam[] {
  return dashboardRows(
    value,
    (item) => {
      const row = dashboardRecord(item, [
        'examId',
        'certificationId',
        'sourceVersion',
        'startedAt',
        'submittedAt',
        'lastAnsweredAt',
        'questionCount',
        'stats',
        'allAnswers',
      ]);
      const stats = readDashboardStats(row.stats),
        allAnswers = readDashboardStats(row.allAnswers);
      assertDashboardSum(allAnswers, [stats], true);
      const startedAt = nullableTime(row.startedAt),
        submittedAt = nullableTime(row.submittedAt),
        lastAnsweredAt = nullableTime(row.lastAnsweredAt);
      const questionCount = row.questionCount === null ? null : dashboardNumber(row.questionCount);
      if (
        (questionCount !== null && (questionCount === 0 || questionCount < allAnswers.answered)) ||
        (startedAt !== null && submittedAt !== null && Date.parse(startedAt) > Date.parse(submittedAt))
      )
        throw new Error('Invalid dashboard exam session.');
      return {
        examId: dashboardText(row.examId),
        certificationId: dashboardText(row.certificationId, 120),
        sourceVersion: dashboardText(row.sourceVersion, 128),
        startedAt,
        submittedAt,
        lastAnsweredAt,
        questionCount,
        stats,
        allAnswers,
      };
    },
    (item) => item.examId,
  );
}

export function readDashboardLessonFinals(value: unknown): DashboardLessonFinal[] {
  return dashboardRows(
    value,
    (item) => {
      const row = dashboardRecord(item, [
        'sessionId',
        'unitId',
        'contentVersion',
        'startedAt',
        'submittedAt',
        'score',
        'requiredScore',
        'questionCount',
        'passed',
        'stats',
        'allAnswers',
      ]);
      const stats = readDashboardStats(row.stats),
        allAnswers = readDashboardStats(row.allAnswers);
      assertDashboardSum(allAnswers, [stats], true);
      const startedAt = timestamp(row.startedAt, 'startedAt'),
        submittedAt = timestamp(row.submittedAt, 'submittedAt');
      const score = dashboardNumber(row.score, 12);
      if (
        row.requiredScore !== 10 ||
        row.questionCount !== 12 ||
        row.passed !== score >= 10 ||
        allAnswers.answered !== 12 ||
        allAnswers.correct !== score ||
        Date.parse(startedAt) > Date.parse(submittedAt)
      )
        throw new Error('Invalid dashboard lesson grade.');
      return {
        sessionId: uuid(row.sessionId, 'sessionId'),
        unitId: dashboardText(row.unitId, 120),
        contentVersion: dashboardText(row.contentVersion, 128),
        startedAt,
        submittedAt,
        score,
        requiredScore: 10,
        questionCount: 12,
        passed: score >= 10,
        stats,
        allAnswers,
      };
    },
    (item) => item.sessionId,
  );
}
