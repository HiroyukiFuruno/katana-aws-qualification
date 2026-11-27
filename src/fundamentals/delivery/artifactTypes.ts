import type { FundamentalsQuestion, FundamentalsUnit } from '../types';
import type { LessonStep } from './slideTypes';

export type DeliveryIndexAsset = {
  schemaVersion: 1;
  units: {
    order: number;
    parent: string;
    objective: string;
    prerequisiteIds: string[];
    next?: string;
    state: 'published' | 'planned';
    checkpointIds: string[];
    finalQuestionIds: string[];
    unitId: string;
    slug: string;
    title: string;
    contentVersion: string;
    contentHash: string;
    minutes: number;
    totalSteps: number;
    checkpointCount: number;
    finalQuestionCount: number;
  }[];
};

export type DeliveryQuestion = Pick<
  FundamentalsQuestion,
  | 'choices'
  | 'correct'
  | 'id'
  | 'learning'
  | 'objectiveId'
  | 'prompt'
  | 'requiredChoices'
  | 'revision'
  | 'sectionId'
  | 'selectionPolarity'
  | 'source'
  | 'title'
> & {
  category: string;
  unitId: string;
  version: string;
};

export type DeliveryFinalPolicy = {
  attemptScope: 'current-attempt-only';
  passCorrect: number;
  questionCount: number;
  ratio: number;
};

export type DeliveryUnitAsset = {
  checkpoints: DeliveryQuestion[];
  contentHash: string;
  contentVersion: string;
  finalPolicy: DeliveryFinalPolicy;
  finalQuestions: DeliveryQuestion[];
  steps: LessonStep[];
  timing: {
    checkpointSeconds: number;
    finalSeconds: number;
    readingSeconds: number;
    totalSeconds: number;
  };
  totalSteps: number;
  unit: Pick<FundamentalsUnit, 'id' | 'next' | 'order' | 'prerequisites' | 'title'>;
};

export type TrustedQuestion = {
  category: string;
  choiceIds: string[];
  correctChoiceIds: string[];
  explanationRef: string;
  objectiveId: string;
  questionId: string;
  requiredChoices: number;
  revision: number;
  sectionId: string;
  selectionPolarity: 'correct' | 'incorrect';
  source: { label: string; url: string };
  sourceVersion: string;
};

export type TrustedFinalQuestion = TrustedQuestion & { position: number };

export type TrustedCatalogUnit = {
  contentHash: string;
  contentVersion: string;
  finalPolicy: DeliveryFinalPolicy;
  finalQuestions: TrustedFinalQuestion[];
  plan: (
    | { id: string; kind: 'slide'; position: number; required: true }
    | {
        id: string;
        kind: 'checkpoint';
        position: number;
        question: TrustedQuestion;
        required: true;
      }
  )[];
  unitId: string;
};

export type DeliveryRouteManifest = {
  schemaVersion: 1;
  units: {
    contentVersion: string;
    finalQuestions: { position: number; questionId: string }[];
    nonFinalSteps: { globalPosition: number; id: string; kind: 'slide' | 'checkpoint' }[];
    slug: string;
    title: string;
    unitId: string;
  }[];
};
