import { parseQuestions } from '../../questions';
import type { DeliveryIndexAsset, DeliveryUnitAsset } from './artifactTypes';
import { type Fetcher, fetchDeliveryJson } from './loadIndex';

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hash = (value: unknown): value is string => text(value) && /^[a-f0-9]{64}$/.test(value);
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

function validStep(value: unknown, index: number, total: number, unitId: string) {
  if (
    !record(value) ||
    !text(value.id) ||
    !['intro', 'reading', 'example', 'misconception', 'takeaway', 'checkpoint', 'final'].includes(
      String(value.kind),
    ) ||
    !['normal', 'misconception', 'source', 'assessment'].includes(String(value.style)) ||
    value.unitId !== unitId ||
    value.position !== index + 1 ||
    value.totalSteps !== total ||
    value.remainingSteps !== total - index - 1 ||
    !integer(value.estimatedSeconds) ||
    value.estimatedSeconds < 1 ||
    !Array.isArray(value.objectiveIds) ||
    !value.objectiveIds.every(text) ||
    !Array.isArray(value.blocks) ||
    !value.blocks.every(
      (block) => record(block) && text(block.label) && text(block.text) && text(block.contentRef),
    ) ||
    !Array.isArray(value.sources) ||
    !value.sources.every(
      (source) =>
        record(source) && text(source.label) && text(source.url) && source.url.startsWith('https://'),
    )
  )
    return false;
  return true;
}

export function parseDeliveryUnit(
  value: unknown,
  entry: DeliveryIndexAsset['units'][number],
): DeliveryUnitAsset {
  if (
    !record(value) ||
    value.contentVersion !== entry.contentVersion ||
    !hash(value.contentHash) ||
    value.contentHash !== entry.contentHash ||
    !Array.isArray(value.steps) ||
    value.steps.length !== entry.totalSteps ||
    !value.steps.every((step, index) => validStep(step, index, entry.totalSteps, entry.unitId)) ||
    !Array.isArray(value.checkpoints) ||
    value.checkpoints.length !== entry.checkpointCount ||
    !Array.isArray(value.finalQuestions) ||
    value.finalQuestions.length !== entry.finalQuestionCount ||
    !record(value.unit) ||
    value.unit.id !== entry.unitId ||
    value.unit.order !== entry.order ||
    !text(value.unit.title) ||
    value.unit.next !== entry.next ||
    !Array.isArray(value.unit.prerequisites) ||
    value.unit.prerequisites.length !== entry.prerequisiteIds.length ||
    value.unit.prerequisites.some((id, index) => id !== entry.prerequisiteIds[index]) ||
    !record(value.timing)
  )
    throw new Error(`Invalid delivery unit asset: ${entry.unitId}`);
  if (
    !record(value.finalPolicy) ||
    value.finalPolicy.attemptScope !== 'current-attempt-only' ||
    value.finalPolicy.passCorrect !== 10 ||
    value.finalPolicy.questionCount !== entry.finalQuestionCount ||
    value.finalPolicy.ratio !== 0.8 ||
    !integer(value.timing.checkpointSeconds) ||
    value.timing.checkpointSeconds < 0 ||
    !integer(value.timing.finalSeconds) ||
    value.timing.finalSeconds < 0 ||
    !integer(value.timing.readingSeconds) ||
    value.timing.readingSeconds < 0 ||
    !integer(value.timing.totalSeconds) ||
    value.timing.totalSeconds < 1
  )
    throw new Error(`Invalid delivery timing or policy: ${entry.unitId}`);
  try {
    parseQuestions(value.checkpoints);
    parseQuestions(value.finalQuestions);
  } catch {
    throw new Error(`Invalid delivery questions: ${entry.unitId}`);
  }
  const checkpointIds = value.steps
    .filter((step): step is Record<string, unknown> => record(step) && step.kind === 'checkpoint')
    .map((step) => step.assessmentId);
  const finalIds = value.steps
    .filter((step): step is Record<string, unknown> => record(step) && step.kind === 'final')
    .map((step) => step.assessmentId);
  if (
    checkpointIds.length !== entry.checkpointCount ||
    checkpointIds.some((id, index) => id !== entry.checkpointIds[index]) ||
    finalIds.length !== entry.finalQuestionCount ||
    finalIds.some((id, index) => id !== entry.finalQuestionIds[index])
  )
    throw new Error(`Delivery final references mismatch: ${entry.unitId}`);
  return value as unknown as DeliveryUnitAsset;
}

export async function loadDeliveryUnit(
  index: DeliveryIndexAsset,
  unitId: string,
  options: { signal?: AbortSignal; fetcher?: Fetcher; basePath?: string } = {},
) {
  const entry = index.units.find((unit) => unit.unitId === unitId);
  if (!entry) throw new Error(`Unknown fundamentals delivery unit: ${unitId}`);
  return parseDeliveryUnit(
    await fetchDeliveryJson(
      `${options.basePath ?? '/fundamentals/delivery'}/${entry.slug}.json`,
      options.signal,
      options.fetcher,
    ),
    entry,
  );
}
