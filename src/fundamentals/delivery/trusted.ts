import type {
  DeliveryQuestion,
  DeliveryUnitAsset,
  TrustedCatalogUnit,
  TrustedQuestion,
} from './artifactTypes';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function trustedQuestion(question: DeliveryQuestion, explanationRef: string): TrustedQuestion {
  if (!question.objectiveId || !question.sectionId) throw new Error('Lesson question has no reference.');
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

function trustedUnit(asset: DeliveryUnitAsset): TrustedCatalogUnit {
  const checkpoints = new Map(asset.checkpoints.map((question) => [question.id, question]));
  const plan = asset.steps
    .filter((step) => step.kind !== 'final')
    .map((step, index) => {
      if (step.kind !== 'checkpoint')
        return { id: step.id, kind: 'slide' as const, position: index + 1, required: true as const };
      const question = checkpoints.get(step.assessmentId ?? '');
      if (!question) throw new Error('Lesson checkpoint is missing.');
      return {
        id: step.id,
        kind: 'checkpoint' as const,
        position: index + 1,
        question: trustedQuestion(question, `checkpoint:${question.id}`),
        required: true as const,
      };
    });
  return {
    contentHash: asset.contentHash,
    contentVersion: asset.contentVersion,
    finalPolicy: asset.finalPolicy,
    finalQuestions: asset.finalQuestions.map((question, position) => ({
      ...trustedQuestion(question, `final:${question.id}`),
      position,
    })),
    plan,
    unitId: asset.unit.id,
  };
}

export function verifyTrustedDeliveryUnit(value: unknown, asset: DeliveryUnitAsset) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid trusted lesson catalog.');
  const catalog = value as { schemaVersion?: unknown; units?: unknown };
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.units))
    throw new Error('Invalid trusted lesson catalog.');
  const expected = trustedUnit(asset);
  const actual = catalog.units.find(
    (unit): unit is TrustedCatalogUnit =>
      Boolean(unit) &&
      typeof unit === 'object' &&
      (unit as { unitId?: unknown }).unitId === asset.unit.id,
  );
  if (!actual || canonicalJson(actual) !== canonicalJson(expected))
    throw new Error(`Untrusted lesson delivery asset: ${asset.unit.id}`);
}
