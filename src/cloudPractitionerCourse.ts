import type { Course } from './certificationTypes';

export const cloudPractitionerCourse: Course = {
  practice: [{ path: 'courses/clf-c02/mock-2026-11.json', label: 'saaFull' }],
  mock: 'courses/clf-c02/mock-2026-11.json',
  archives: ['courses/clf-c02/questions.json'],
  exam: {
    minutes: 90,
    distribution: {
      クラウドの概念: 16,
      セキュリティとコンプライアンス: 19,
      クラウド技術とサービス: 22,
      請求と料金とサポート: 8,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};
