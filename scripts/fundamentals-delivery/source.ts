import type { DeliveryQuestion } from '../../src/fundamentals/delivery/artifactTypes';
import type { FundamentalsContent, FundamentalsUnit } from '../../src/fundamentals/types';

type RawCheckpoint = Omit<DeliveryQuestion, 'category' | 'revision' | 'title' | 'unitId' | 'version'> & {
  revision?: number;
};

export type CheckpointDocument = {
  schemaVersion: 1;
  units: { checkpoints: RawCheckpoint[]; unitId: string }[];
};

export function requireUnits(content: FundamentalsContent, checkpoints: CheckpointDocument) {
  if (content.units.length !== 12 || checkpoints.units.length !== 12)
    throw new Error('Delivery requires 12 units.');
  const byId = new Map(checkpoints.units.map((item) => [item.unitId, item.checkpoints]));
  if (byId.size !== 12) throw new Error('Checkpoint unit IDs must be unique.');
  return content.units.map((unit) => ({
    checkpoints: normalizeCheckpoints(unit, byId.get(unit.id) ?? []),
    unit,
  }));
}

export function normalizeCheckpoints(unit: FundamentalsUnit, checkpoints: RawCheckpoint[]) {
  const objectives = new Map((unit.learningObjectives ?? []).map((item) => [item.id, item]));
  const sections = new Map((unit.sections ?? []).map((item) => [item.id, item]));
  if (sections.size !== 4 || objectives.size !== 4 || checkpoints.length !== 4)
    throw new Error(`${unit.id} requires four sections, objectives, and checkpoints.`);
  const seen = new Set<string>();
  return checkpoints.map((checkpoint) => {
    const section = sections.get(checkpoint.sectionId ?? '');
    const objective = objectives.get(checkpoint.objectiveId ?? '');
    if (!section || !objective?.sectionIds.includes(section.id) || seen.has(checkpoint.id))
      throw new Error(`${unit.id} checkpoint is invalid.`);
    seen.add(checkpoint.id);
    if (
      (checkpoint.revision !== undefined &&
        (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 1)) ||
      checkpoint.requiredChoices !== checkpoint.correct.length ||
      !checkpoint.correct.every((choice) => checkpoint.choices.some((item) => item.id === choice))
    )
      throw new Error(`${checkpoint.id} checkpoint choices are invalid.`);
    return {
      ...checkpoint,
      category: unit.id,
      revision: checkpoint.revision ?? 1,
      title: section.title,
      unitId: unit.id,
      version: '2026-11-learning',
    };
  });
}

export function normalizeFinals(unit: FundamentalsUnit): DeliveryQuestion[] {
  if (unit.questions.length !== 12) throw new Error(`${unit.id} requires 12 final questions.`);
  return unit.questions.map((question) => ({
    category: question.category,
    choices: question.choices,
    correct: question.correct,
    id: question.id,
    objectiveId: question.objectiveId,
    prompt: question.prompt,
    requiredChoices: question.requiredChoices,
    revision: question.revision,
    sectionId: question.sectionId,
    selectionPolarity: question.selectionPolarity,
    source: question.source,
    title: question.title,
    unitId: unit.id,
    version: question.version,
  }));
}
