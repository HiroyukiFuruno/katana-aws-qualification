import type { Course } from './certificationTypes';

const mock = 'courses/scs-c03/full-mock-2026-11.json';

export const securitySpecialtyCourse: Course = {
  practice: [{ path: mock, label: 'saaFull' }],
  mock,
  archives: ['courses/scs-c03/questions.json', 'courses/scs-c03/mock-2026-11.json'],
  examStorageId: 'scs-c03',
  exam: {
    minutes: 170,
    distribution: {
      検出: 10,
      インシデント対応: 9,
      インフラストラクチャのセキュリティ: 12,
      アイデンティティとアクセス管理: 13,
      データ保護: 12,
      セキュリティ基盤とガバナンス: 9,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};
