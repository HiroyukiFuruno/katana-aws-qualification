export type LessonStepKind =
  | 'intro'
  | 'reading'
  | 'example'
  | 'misconception'
  | 'takeaway'
  | 'checkpoint'
  | 'final';

export type LessonSlideBlock = {
  kind:
    | 'summary'
    | 'objective'
    | 'paragraph'
    | 'scenario'
    | 'steps'
    | 'outcome'
    | 'misconception'
    | 'correction'
    | 'takeaway';
  label: string;
  text: string;
  contentRef: string;
};

export type LessonStep = {
  id: string;
  kind: LessonStepKind;
  style: 'normal' | 'misconception' | 'source' | 'assessment';
  unitId: string;
  sectionId?: string;
  objectiveIds: string[];
  label: string;
  blocks: LessonSlideBlock[];
  sources: { label: string; url: string }[];
  assessmentId?: string;
  estimatedSeconds: number;
  position: number;
  totalSteps: number;
  remainingSteps: number;
};
