import type { Skill } from './certifications';
import type { Message } from './messages';

export type AssessmentItem = {
  id: string;
  skill: Skill;
  prompt: Message;
  options: [Message, Message, Message];
  correct: number;
};
