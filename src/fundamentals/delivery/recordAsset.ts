import { exactFields, nullable, object, text } from '../state/codecPrimitives';
import type { DeliveryFinalPolicy } from './artifactTypes';
import {
  type LessonRecordQuestion,
  readRecordFinalPolicy,
  readRecordQuestions,
} from './recordAssessmentCodec';
import type { LessonStepKind } from './slideTypes';

export type { LessonRecordQuestion } from './recordAssessmentCodec';

export type LessonRecordStep = {
  assessmentId?: string | null;
  id: string;
  kind: LessonStepKind;
};

export type LessonRecordAsset = {
  checkpoints: LessonRecordQuestion[];
  contentHash: string;
  contentVersion: string;
  finalPolicy: DeliveryFinalPolicy;
  finalQuestions: LessonRecordQuestion[];
  steps: LessonRecordStep[];
  unit: { id: string; title: string };
};

function recordQuestion(question: LessonRecordQuestion): LessonRecordQuestion {
  return {
    category: question.category,
    choices: question.choices.map((choice) => ({ id: choice.id })),
    correct: [...question.correct],
    id: question.id,
    requiredChoices: question.requiredChoices,
    revision: question.revision,
    selectionPolarity: question.selectionPolarity,
    version: question.version,
  };
}

export function toLessonRecordAsset(asset: LessonRecordAsset): LessonRecordAsset {
  return {
    checkpoints: asset.checkpoints.map(recordQuestion),
    contentHash: asset.contentHash,
    contentVersion: asset.contentVersion,
    finalPolicy: { ...asset.finalPolicy },
    finalQuestions: asset.finalQuestions.map(recordQuestion),
    steps: asset.steps.map((step) => ({
      assessmentId: step.assessmentId ?? null,
      id: step.id,
      kind: step.kind,
    })),
    unit: { id: asset.unit.id, title: asset.unit.title },
  };
}

function readStep(value: unknown): LessonRecordStep {
  const row = object(value, 'recordStep');
  exactFields(row, ['assessmentId', 'id', 'kind']);
  const kind = text(row.kind, 'recordStep.kind');
  if (
    !['intro', 'reading', 'example', 'misconception', 'takeaway', 'checkpoint', 'final'].includes(kind)
  ) {
    throw new Error('Invalid lesson record step kind.');
  }
  const assessmentId = nullable(row.assessmentId, (item) => text(item, 'recordStep.assessmentId'));
  if ((kind === 'checkpoint' || kind === 'final') !== (assessmentId !== null)) {
    throw new Error('Invalid lesson record assessment reference.');
  }
  return { assessmentId, id: text(row.id, 'recordStep.id'), kind: kind as LessonStepKind };
}

function sameQuestionOrder(
  steps: LessonRecordStep[],
  kind: 'checkpoint' | 'final',
  questions: LessonRecordQuestion[],
) {
  const references = steps.filter((step) => step.kind === kind).map((step) => step.assessmentId);
  return (
    references.length === questions.length &&
    references.every((reference, index) => reference === questions[index]?.id)
  );
}

function validateRecordAsset(asset: LessonRecordAsset) {
  if (
    asset.steps.length === 0 ||
    asset.steps[0]?.kind === 'checkpoint' ||
    asset.steps[0]?.kind === 'final' ||
    new Set(asset.steps.map((step) => step.id)).size !== asset.steps.length ||
    !sameQuestionOrder(asset.steps, 'checkpoint', asset.checkpoints) ||
    !sameQuestionOrder(asset.steps, 'final', asset.finalQuestions) ||
    asset.finalQuestions.length !== asset.finalPolicy.questionCount
  ) {
    throw new Error('Invalid lesson record plan.');
  }
  const questionIds = [...asset.checkpoints, ...asset.finalQuestions].map((question) => question.id);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error('Lesson record question identifiers must be unique.');
  }
}

export function readLessonRecordAsset(
  raw: unknown,
  unitId: string,
  contentVersion: string,
): LessonRecordAsset {
  const row = object(raw, 'lessonRecordAsset');
  exactFields(row, [
    'checkpoints',
    'contentHash',
    'contentVersion',
    'finalPolicy',
    'finalQuestions',
    'steps',
    'unit',
  ]);
  if (!Array.isArray(row.steps)) throw new Error('Invalid lesson record steps.');
  const unit = object(row.unit, 'recordUnit');
  exactFields(unit, ['id', 'title']);
  if (unit.id !== unitId || row.contentVersion !== contentVersion) {
    throw new Error('Lesson record belongs to another published lesson.');
  }
  const contentHash = text(row.contentHash, 'record.contentHash');
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error('Invalid lesson record content hash.');
  const asset: LessonRecordAsset = {
    checkpoints: readRecordQuestions(row.checkpoints, 'checkpoints'),
    contentHash,
    contentVersion: text(row.contentVersion, 'record.contentVersion'),
    finalPolicy: readRecordFinalPolicy(row.finalPolicy),
    finalQuestions: readRecordQuestions(row.finalQuestions, 'finalQuestions'),
    steps: row.steps.map(readStep),
    unit: { id: text(unit.id, 'record.unit.id'), title: text(unit.title, 'record.unit.title') },
  };
  validateRecordAsset(asset);
  return asset;
}
