import { certifications } from '../certifications';
import { canonicalInstant, isPlainDate } from './dates';
import { type Milestone, type MilestoneInput, type MilestoneKind, milestoneKinds } from './types';

const certificationIds = new Set(certifications.map(({ id }) => id));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const keys = (value: object) => Object.keys(value).sort().join(',');
const inputKeys = 'certificationId,completed,id,kind,plannedAt,plannedOn,title';

function counter(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid milestone revision.');
  return value as number;
}

function shape(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid milestone.');
  return value as Record<string, unknown>;
}

function validateCommon(item: Record<string, unknown>, withRevision: boolean): MilestoneInput {
  if (
    keys(item) !==
    (withRevision ? 'certificationId,completed,id,kind,plannedAt,plannedOn,revision,title' : inputKeys)
  )
    throw new Error('Invalid milestone shape.');
  if (typeof item.id !== 'string' || !uuid.test(item.id)) throw new Error('Invalid milestone id.');
  if (typeof item.certificationId !== 'string' || !certificationIds.has(item.certificationId))
    throw new Error('Invalid certification id.');
  if (typeof item.kind !== 'string' || !milestoneKinds.includes(item.kind as MilestoneKind))
    throw new Error('Invalid milestone kind.');
  if (
    typeof item.title !== 'string' ||
    item.title !== item.title.trim() ||
    Array.from(item.title).length < 1 ||
    Array.from(item.title).length > 120
  )
    throw new Error('Invalid milestone title.');
  if (
    (item.plannedOn !== null && typeof item.plannedOn !== 'string') ||
    (typeof item.plannedOn === 'string' && !isPlainDate(item.plannedOn))
  )
    throw new Error('Invalid milestone date.');
  if (
    (item.plannedAt !== null && typeof item.plannedAt !== 'string') ||
    (typeof item.plannedAt === 'string' && canonicalInstant(item.plannedAt) === null)
  )
    throw new Error('Invalid milestone instant.');
  if (typeof item.completed !== 'boolean') throw new Error('Invalid milestone completion.');
  if (item.plannedOn === null && item.plannedAt === null) throw new Error('Milestone date is required.');
  if (item.plannedOn !== null && item.plannedAt !== null)
    throw new Error('Milestone dates are exclusive.');
  if (item.kind === 'target' && (item.plannedOn === null || item.completed))
    throw new Error('Invalid target milestone.');
  if (withRevision) counter(item.revision);
  return {
    id: item.id as string,
    certificationId: item.certificationId as string,
    kind: item.kind as MilestoneKind,
    title: item.title as string,
    plannedOn: item.plannedOn as string | null,
    plannedAt: item.plannedAt === null ? null : canonicalInstant(item.plannedAt as string),
    completed: item.completed as boolean,
  };
}

export function readMilestone(value: unknown): Milestone {
  const item = shape(value);
  const input = validateCommon(item, true);
  return { ...input, revision: counter(item.revision) };
}

export function readMilestones(value: unknown): Milestone[] {
  if (!Array.isArray(value)) throw new Error('Invalid milestone list.');
  const milestones = value.map(readMilestone);
  if (new Set(milestones.map(({ id }) => id)).size !== milestones.length)
    throw new Error('Duplicate milestone id.');
  return milestones;
}

export function validateMilestoneInput(value: unknown): MilestoneInput {
  return validateCommon(shape(value), false);
}
