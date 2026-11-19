import type { Course } from './certificationTypes';

const mock = 'courses/mla-c01/full-mock-2026-11.json';

export const machineLearningEngineerCourse: Course = {
  practice: [{ path: mock, label: 'saaFull' }],
  mock,
  archives: ['courses/mla-c01/questions.json', 'courses/mla-c01/mock-2026-11.json'],
  examStorageId: 'mla-c01',
  exam: {
    minutes: 130,
    distribution: {
      機械学習のためのデータ準備: 18,
      MLモデルの開発: 17,
      MLワークフローのデプロイとオーケストレーション: 14,
      'MLソリューションのモニタリング、保守、セキュリティ': 16,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};
