import type {
  DeliveryFinalPolicy,
  DeliveryQuestion,
  TrustedCatalogUnit,
  TrustedFinalQuestion,
  TrustedQuestion,
} from '../../src/fundamentals/delivery/artifactTypes';
import type { LessonStep } from '../../src/fundamentals/delivery/slideTypes';

function trustedQuestion(question: DeliveryQuestion, explanationRef: string): TrustedQuestion {
  if (!question.objectiveId || !question.sectionId)
    throw new Error(`${question.id} has no lesson reference.`);
  return {
    category: question.category,
    choiceIds: question.choices.map((choice) => choice.id),
    correctChoiceIds: question.correct,
    explanationRef,
    objectiveId: question.objectiveId,
    questionId: question.id,
    requiredChoices: question.requiredChoices,
    revision: question.revision,
    sectionId: question.sectionId,
    selectionPolarity: question.selectionPolarity,
    source: question.source,
    sourceVersion: question.version,
  };
}

export function trustedCatalogUnit(
  unitId: string,
  contentVersion: string,
  contentHash: string,
  steps: LessonStep[],
  checkpoints: DeliveryQuestion[],
  finals: DeliveryQuestion[],
  finalPolicy: DeliveryFinalPolicy,
): TrustedCatalogUnit {
  const checkpointById = new Map(checkpoints.map((question) => [question.id, question]));
  const plan = steps
    .filter((step) => step.kind !== 'final')
    .map((step, index) => {
      const position = index + 1;
      if (step.kind !== 'checkpoint')
        return { id: step.id, kind: 'slide' as const, position, required: true as const };
      const question = checkpointById.get(step.assessmentId ?? '');
      if (!question) throw new Error(`${step.id} checkpoint is missing.`);
      return {
        id: step.id,
        kind: 'checkpoint' as const,
        position,
        question: trustedQuestion(question, `checkpoint:${question.id}`),
        required: true as const,
      };
    });
  return {
    contentHash,
    contentVersion,
    finalPolicy,
    finalQuestions: finals.map(
      (question, position): TrustedFinalQuestion => ({
        ...trustedQuestion(question, `final:${question.id}`),
        position,
      }),
    ),
    plan,
    unitId,
  };
}
