export const publicTables = [
  'assessment_answers',
  'dashboard_settings',
  'earned_certifications',
  'exam_responses',
  'exam_sessions',
  'fundamentals_final_sessions',
  'fundamentals_unit_progress',
  'learning_events',
  'learning_state',
  'migration_items',
  'migration_manifests',
  'roadmap_profiles',
] as const;

export type PublicTable = (typeof publicTables)[number];
export type RawRow = Record<string, unknown>;
export type SnapshotDocument = {
  algorithm_version: number;
  accounts: string[];
  lineage_accounts?: string[];
  tables: Record<string, unknown>;
};
export type SourceSnapshot = { sqlDigest: string; document: SnapshotDocument };
export type MergeSource = {
  accountId: string;
  snapshot: SourceSnapshot;
  provenance: 'source' | 'target';
};
export type AuxiliaryInput = {
  version: 1;
  examResume?: Array<{ certificationId: string; examId: string }>;
  manifestReplayHeads?: Array<{ sourceName: string; sourceFingerprint: string; manifestId: string }>;
};
export type ProjectionInput = { source: MergeSource; target: MergeSource; auxiliary?: AuxiliaryInput };
export type RetainedRow = {
  table: PublicTable;
  provenance: MergeSource['provenance'];
  identity: string;
  raw: RawRow;
};
export type DuplicateRow = RetainedRow & {
  duplicateOf: { provenance: MergeSource['provenance']; identity: string };
};
export type Selection = {
  id: string;
  kind: 'assessment' | 'dashboard' | 'exam-resume' | 'final-resume' | 'manifest-head' | 'roadmap';
  options: string[];
};
export type Conflict = {
  table: PublicTable;
  kind: string;
  identities: string[];
  selectionId?: string;
  detail: Record<string, unknown>;
};
export type ProjectionPlan = {
  sqlDigests: { source: string; target: string };
  retained: RetainedRow[];
  duplicates: DuplicateRow[];
  conflicts: Conflict[];
  requiredSelections: Selection[];
  auxiliary?: AuxiliaryInput;
  auxiliaryConnected: false;
  fundamentalsUnions: Array<{
    unitId: string;
    contentVersion: string;
    slideIds: string[];
    checkpointIds: string[];
    continuity: 'review-required';
    observedPositions: number[];
  }>;
};
