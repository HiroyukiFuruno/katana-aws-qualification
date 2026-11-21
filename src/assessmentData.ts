import type { AssessmentItem } from './assessmentTypes';

export const assessmentData: AssessmentItem[] = [
  {
    id: 'f1',
    skill: 'fundamentals',
    prompt: 'assessmentF1Prompt',
    options: ['assessmentF1Option1', 'assessmentF1Option2', 'assessmentF1Option3'],
    correct: 1,
  },
  {
    id: 'f2',
    skill: 'fundamentals',
    prompt: 'assessmentF2Prompt',
    options: ['assessmentF2Option1', 'assessmentF2Option2', 'assessmentF2Option3'],
    correct: 0,
  },
  {
    id: 'a1',
    skill: 'architecture',
    prompt: 'assessmentA1Prompt',
    options: ['assessmentA1Option1', 'assessmentA1Option2', 'assessmentA1Option3'],
    correct: 2,
  },
  {
    id: 'a2',
    skill: 'architecture',
    prompt: 'assessmentA2Prompt',
    options: ['assessmentA2Option1', 'assessmentA2Option2', 'assessmentA2Option3'],
    correct: 0,
  },
  {
    id: 's1',
    skill: 'security',
    prompt: 'assessmentS1Prompt',
    options: ['assessmentS1Option1', 'assessmentS1Option2', 'assessmentS1Option3'],
    correct: 1,
  },
  {
    id: 's2',
    skill: 'security',
    prompt: 'assessmentS2Prompt',
    options: ['assessmentS2Option1', 'assessmentS2Option2', 'assessmentS2Option3'],
    correct: 2,
  },
  {
    id: 'n1',
    skill: 'networking',
    prompt: 'assessmentN1Prompt',
    options: ['assessmentN1Option1', 'assessmentN1Option2', 'assessmentN1Option3'],
    correct: 0,
  },
  {
    id: 'n2',
    skill: 'networking',
    prompt: 'assessmentN2Prompt',
    options: ['assessmentN2Option1', 'assessmentN2Option2', 'assessmentN2Option3'],
    correct: 2,
  },
  {
    id: 'd1',
    skill: 'development',
    prompt: 'assessmentD1Prompt',
    options: ['assessmentD1Option1', 'assessmentD1Option2', 'assessmentD1Option3'],
    correct: 0,
  },
];
