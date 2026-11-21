import type { AssessmentItem } from './assessmentTypes';

export const assessmentExtra: AssessmentItem[] = [
  {
    id: 'd2',
    skill: 'development',
    prompt: 'assessmentD2Prompt',
    options: ['assessmentD2Option1', 'assessmentD2Option2', 'assessmentD2Option3'],
    correct: 1,
  },
  {
    id: 'o1',
    skill: 'operations',
    prompt: 'assessmentO1Prompt',
    options: ['assessmentO1Option1', 'assessmentO1Option2', 'assessmentO1Option3'],
    correct: 2,
  },
  {
    id: 'o2',
    skill: 'operations',
    prompt: 'assessmentO2Prompt',
    options: ['assessmentO2Option1', 'assessmentO2Option2', 'assessmentO2Option3'],
    correct: 0,
  },
  {
    id: 'e1',
    skill: 'data',
    prompt: 'assessmentE1Prompt',
    options: ['assessmentE1Option1', 'assessmentE1Option2', 'assessmentE1Option3'],
    correct: 1,
  },
  {
    id: 'e2',
    skill: 'data',
    prompt: 'assessmentE2Prompt',
    options: ['assessmentE2Option1', 'assessmentE2Option2', 'assessmentE2Option3'],
    correct: 2,
  },
  {
    id: 'i1',
    skill: 'ai',
    prompt: 'assessmentI1Prompt',
    options: ['assessmentI1Option1', 'assessmentI1Option2', 'assessmentI1Option3'],
    correct: 0,
  },
  {
    id: 'i2',
    skill: 'ai',
    prompt: 'assessmentI2Prompt',
    options: ['assessmentI2Option1', 'assessmentI2Option2', 'assessmentI2Option3'],
    correct: 1,
  },
];
