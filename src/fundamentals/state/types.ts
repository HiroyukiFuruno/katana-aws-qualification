export type LessonQuestionRef = {
  questionId: string;
  revision: number;
  sourceVersion: string;
};

export type LessonResponse = {
  questionRef: LessonQuestionRef;
  selected: string[];
  selectedAt: string;
  durationMs: number;
};

export type LessonProgress = {
  completedSlideIds: string[];
  completedCheckpointIds: string[];
  furthestPlanPosition: number;
  resumeStage: 'slide' | 'checkpoint' | 'final' | 'result';
  resumeStepId: string | null;
  activeFinalSessionId: string | null;
  passedFinalSessionId: string | null;
  passedAt: string | null;
  revision: number;
};

export type LessonFinalSession = {
  sessionId: string;
  position: number;
  state: 'draft' | 'submitted';
  responses: Record<string, LessonResponse>;
  score: number | null;
  requiredScore: number;
  passed: boolean | null;
  submittedAt: string | null;
  revision: number;
};

export type LessonSnapshot = {
  unitId: string;
  contentVersion: string;
  progress: LessonProgress;
  sessions: LessonFinalSession[];
  checkpointResult?: { isCorrect: boolean; explanationRef: string };
};

export type GuestCheckpointReceipt = {
  stepId: string;
  receiptId: string;
  questionRef: LessonQuestionRef;
  selected: string[];
  answeredAt: string;
  durationMs: number;
};

export type GuestFinalSource = {
  sessionId: string;
  startedAt: string;
  position: number;
  questionOrder: (LessonQuestionRef & { position: number })[];
  responses: Record<string, LessonResponse>;
};

export type GuestSubmittedFinalSource = GuestFinalSource & {
  submittedAt: string;
  eventIds: string[];
};

export type GuestLessonSource = {
  unitId: string;
  contentVersion: string;
  completedSlideIds: string[];
  completedCheckpointIds: string[];
  furthestPlanPosition: number;
  resumeStage: LessonProgress['resumeStage'];
  resumeStepId: string | null;
  checkpointReceipts: GuestCheckpointReceipt[];
  activeFinal: GuestFinalSource | null;
  submittedFinals: GuestSubmittedFinalSource[];
};
