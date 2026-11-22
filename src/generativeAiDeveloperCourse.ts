import type { Course } from './certificationTypes';

const mock = 'courses/aip-c01/full-mock-2026-11.json';

export const generativeAiDeveloperCourse: Course = {
  practice: [{ path: mock, label: 'saaFull' }],
  mock,
  archives: [
    'courses/aip-c01/questions.json',
    'courses/aip-c01/mock-2026-11.json',
    'courses/aip-c01/archive-2026-11-22.json',
  ],
  examStorageId: 'aip-c01',
  exam: {
    minutes: 180,
    distribution: {
      '基盤モデルの統合・データ管理・コンプライアンス': 23,
      実装と統合: 20,
      'AIの安全性・セキュリティ・ガバナンス': 15,
      '生成AIアプリの運用効率・最適化': 9,
      'テスト・検証・トラブルシューティング': 8,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};
