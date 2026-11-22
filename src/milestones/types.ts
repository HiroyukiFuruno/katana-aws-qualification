export const milestoneKinds = ['target', 'study', 'mock_exam', 'exam'] as const;
export type MilestoneKind = (typeof milestoneKinds)[number];

export type Milestone = {
  id: string;
  certificationId: string;
  kind: MilestoneKind;
  title: string;
  plannedOn: string | null;
  plannedAt: string | null;
  completed: boolean;
  revision: number;
};

export type MilestoneInput = Omit<Milestone, 'revision'>;
