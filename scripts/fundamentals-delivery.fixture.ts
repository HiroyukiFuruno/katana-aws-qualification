import type { FundamentalsContent } from '../src/fundamentals/types';
import type { CheckpointDocument } from './fundamentals-delivery/source';

export const content = (await Bun.file(
  'public/fundamentals/content.json',
).json()) as FundamentalsContent;
export const checkpoints = (await Bun.file(
  'public/fundamentals/checkpoints.json',
).json()) as CheckpointDocument;

export function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}.`);
  return value;
}
