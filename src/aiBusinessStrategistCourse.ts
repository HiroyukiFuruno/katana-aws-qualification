import type { Course } from './certificationTypes';

const mock = 'courses/ai-business-strategist/full-mock-2026-11.json';

export const aiBusinessStrategistCourse: Course = {
  practice: [{ path: mock, label: 'saaFull' }],
  mock,
  questionTranslations: 'courses/ai-business-strategist/locales',
  archives: [
    'courses/ai-business-strategist/questions.json',
    'courses/ai-business-strategist/mock-2026-11.json',
  ],
  examStorageId: 'ai-business-strategist',
  exam: {
    minutes: 170,
    distribution: {
      AIの基礎とリテラシー: 21,
      AI戦略と事業価値の創出: 24,
      AIガバナンスと責任あるAIのリーダーシップ: 20,
      '事業準備度・リーダーシップ・AI変革': 20,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};
