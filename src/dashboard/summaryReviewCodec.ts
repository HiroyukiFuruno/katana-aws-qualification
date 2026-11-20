import { timestamp } from '../fundamentals/state/codecPrimitives';
import { dashboardEnum, dashboardNumber, dashboardRecord, dashboardText } from './codec';
import { dashboardContexts } from './filterCodec';
import { dashboardRevisionNumber } from './summaryGroupCodec';
import { dashboardRows } from './summaryStatsCodec';
import type { DashboardReview } from './summaryTypes';

export function readDashboardReviews(value: unknown): DashboardReview[] {
  return dashboardRows(
    value,
    (item) => {
      const row = dashboardRecord(item, [
        'certificationId',
        'questionId',
        'questionRevision',
        'sourceVersion',
        'category',
        'context',
        'unitId',
        'contentVersion',
        'answered',
        'incorrectCount',
        'latestAnsweredAt',
      ]);
      const answered = dashboardNumber(row.answered);
      const incorrectCount = dashboardNumber(row.incorrectCount, answered);
      const context = dashboardEnum(row.context, dashboardContexts);
      const unitId = row.unitId === null ? null : dashboardText(row.unitId, 120);
      const contentVersion = row.contentVersion === null ? null : dashboardText(row.contentVersion, 128);
      if (
        incorrectCount === 0 ||
        context === 'exam' ||
        (unitId === null) !== (contentVersion === null) ||
        ((context === 'lesson-checkpoint' || context === 'lesson-final') && unitId === null)
      )
        throw new Error('Invalid dashboard review candidate.');
      return {
        certificationId: dashboardText(row.certificationId, 120),
        questionId: dashboardText(row.questionId),
        questionRevision: dashboardRevisionNumber(row.questionRevision),
        sourceVersion: dashboardText(row.sourceVersion, 128),
        category: dashboardText(row.category),
        context,
        unitId,
        contentVersion,
        answered,
        incorrectCount,
        latestAnsweredAt: timestamp(row.latestAnsweredAt, 'latestAnsweredAt'),
      };
    },
    (item) =>
      JSON.stringify([item.certificationId, item.questionId, item.questionRevision, item.sourceVersion]),
  );
}
