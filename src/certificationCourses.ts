import type { Certification, Course } from './certificationTypes';

const starterCourseIds = new Set([
  'clf-c02',
  'aif-c01',
  'dva-c02',
  'soa-c03',
  'dea-c01',
  'mla-c01',
  'sap-c03',
  'dop-c02',
  'aip-c01',
  'scs-c03',
  'ans-c01',
  'ai-business-strategist',
]);

const uniqueCounts: Record<string, number> = {
  'aif-c01': 9,
  'aip-c01': 9,
  'dop-c02': 9,
  'mla-c01': 9,
  'scs-c03': 9,
};

function starterCourse(certification: Certification): Course {
  const legacyId = certification.id === 'sap-c03' ? 'sap-c02' : certification.id;
  const mock = `courses/${certification.id}/mock-2026-11.json`;
  const professional = certification.id === 'sap-c03';
  const count = uniqueCounts[certification.id] ?? 10;

  return {
    practice: [{ path: mock, label: professional ? 'saaFull' : 'shortExam' }],
    mock,
    archives: [`courses/${legacyId}/questions.json`],
    examStorageId: legacyId,
    exam: professional
      ? {
          minutes: 180,
          distribution: {
            クラウドアーキテクチャ: 19,
            'セキュリティ・コンプライアンス・ガバナンス': 19,
            コスト最適化: 11,
            'レジリエンス・移行・事業継続': 11,
            '運用上の優秀性・自動化': 15,
          },
        }
      : { minutes: count * 2, distribution: { [certification.focus]: count } },
    fixedExamFromBlueprint: professional,
    reviewedMock: professional ? true : undefined,
    setSize: 4,
  };
}

export function withAvailableCourses(catalog: Certification[]): Certification[] {
  return catalog.map((certification) =>
    certification.course || !starterCourseIds.has(certification.id)
      ? certification
      : { ...certification, course: starterCourse(certification) },
  );
}
