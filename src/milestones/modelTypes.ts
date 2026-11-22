import type { Milestone, MilestoneInput } from './types';

export type MilestoneSnapshot = { items: Milestone[]; generation: number };
export type MilestoneApi = {
  load(): Promise<MilestoneSnapshot>;
  save(input: MilestoneInput, revision: number | null, generation: number): Promise<Milestone>;
  remove(id: string, revision: number, generation: number): Promise<void>;
};
export type MilestonesNotice = 'idle' | 'saving' | 'saved' | 'load-error' | 'save-error' | 'conflict';
export type MilestonesModel = {
  items: readonly Milestone[];
  loading: boolean;
  disabled: boolean;
  notice: MilestonesNotice;
  reload(): void;
  save(input: MilestoneInput, revision: number | null): Promise<boolean>;
  remove(row: Milestone): Promise<boolean>;
};
