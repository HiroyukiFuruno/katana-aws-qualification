import type { Certification } from './certificationTypes';

const mock = 'courses/mla-c02/mock-2026-11.json';

export const machineLearningEngineerBeta: Certification = {
  id: 'mla-c02',
  name: 'Machine Learning Engineer',
  level: 'アソシエイト',
  skills: ['ai', 'data', 'operations'],
  focus: 'モデルの構築・デプロイ・監視',
  beta: true,
  course: {
    practice: [{ path: mock, label: 'saaFull' }],
    mock,
    archives: [],
    examStorageId: 'mla-c02',
    studyLocale: 'en',
    exam: {
      minutes: 170,
      distribution: {
        'Data Preparation for ML and AI': 24,
        'ML Model and Foundation Model (FM) Development': 21,
        'Deployment and Orchestration of ML and AI Workflows': 20,
        'Operating, Monitoring, and Securing ML and AI Solutions': 20,
      },
    },
    fixedExamFromBlueprint: true,
    reviewedMock: true,
  },
};
