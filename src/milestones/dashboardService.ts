import type { ProgressRpcClient } from '../progress/types';
import type { MilestoneApi } from './modelTypes';
import { createMilestonesRepository } from './repository';

export function createMilestoneService(
  client: ProgressRpcClient,
  ready: () => Promise<number>,
  read: <T>(operation: () => Promise<T>) => Promise<T>,
): MilestoneApi {
  const repository = createMilestonesRepository(client);
  return {
    load: () =>
      read(async () => {
        const generation = await ready();
        return { generation, items: await repository.list(generation) };
      }),
    save: (input, revision, generation) => repository.save(input, revision, generation),
    remove: (id, revision, generation) => repository.remove(id, revision, generation),
  };
}
