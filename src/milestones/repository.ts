import type { ProgressRpcClient } from '../progress/types';
import { readMilestone, readMilestones, validateMilestoneInput } from './codec';
import type { Milestone, MilestoneInput } from './types';

export function createMilestonesRepository(client: ProgressRpcClient) {
  const counter = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid milestone counter.');
    return value;
  };
  return {
    async list(generation: number): Promise<Milestone[]> {
      counter(generation);
      const result = await client.rpc<unknown>('list_certification_milestones', {
        p_expected_generation: generation,
      });
      return readMilestones(result);
    },
    async save(
      input: MilestoneInput,
      expectedRevision: number | null,
      generation: number,
    ): Promise<Milestone> {
      const values = validateMilestoneInput(input);
      counter(generation);
      if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0))
        throw new Error('Invalid milestone revision.');
      const saved = readMilestone(
        await client.rpc<unknown>('save_certification_milestone', {
          p_id: values.id,
          p_certification_id: values.certificationId,
          p_kind: values.kind,
          p_title: values.title,
          p_planned_on: values.plannedOn,
          p_planned_at: values.plannedAt,
          p_completed: values.completed,
          p_expected_revision: expectedRevision,
          p_expected_generation: generation,
        }),
      );
      if (
        saved.id !== values.id ||
        saved.certificationId !== values.certificationId ||
        saved.kind !== values.kind ||
        saved.title !== values.title ||
        saved.plannedOn !== values.plannedOn ||
        saved.plannedAt !== values.plannedAt ||
        saved.completed !== values.completed ||
        saved.revision < (expectedRevision ?? 0)
      )
        throw new Error('Milestone acknowledgement differs.');
      return saved;
    },
    async remove(id: string, revision: number, generation: number): Promise<void> {
      if (
        typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ||
        !Number.isSafeInteger(revision) ||
        revision < 0
      )
        throw new Error('Invalid milestone removal.');
      counter(generation);
      const result = await client.rpc<unknown>('delete_certification_milestone', {
        p_id: id,
        p_expected_revision: revision,
        p_expected_generation: generation,
      });
      if (result !== true) throw new Error('Invalid milestone removal acknowledgement.');
    },
  };
}
