import { parseQuestions, questionKey } from '../questions.ts';

export function parseCheckpointQuestions(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('units' in value) ||
    !Array.isArray(value.units)
  ) {
    throw new Error('Invalid checkpoint question catalog.');
  }
  const units = new Set<string>();
  const questions = value.units.flatMap((unit: unknown) => {
    if (
      !unit ||
      typeof unit !== 'object' ||
      !('unitId' in unit) ||
      typeof unit.unitId !== 'string' ||
      !('checkpoints' in unit) ||
      units.has(unit.unitId)
    )
      throw new Error('Invalid checkpoint unit.');
    const unitId = unit.unitId;
    units.add(unitId);
    return parseQuestions(unit.checkpoints).map((question) => {
      if (!question.id.startsWith(`${unitId}.checkpoint.`) || question.category !== unitId) {
        throw new Error('The checkpoint identity is outside its unit.');
      }
      return question;
    });
  });
  if (new Set(questions.map(questionKey)).size !== questions.length) {
    throw new Error('Duplicate checkpoint question identity.');
  }
  return questions;
}
