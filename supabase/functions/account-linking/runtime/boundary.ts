import { checkedNow } from './context.ts';
import { failure, localFailure } from './slots.ts';
import type { RuntimeClock } from './types.ts';

export class RuntimeBoundary {
  constructor(private readonly clock: RuntimeClock) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw localFailure(error) ?? failure('repository_failed');
    }
  }

  async dependency<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw failure('repository_failed');
    }
  }

  now(): number {
    let value: number;
    try {
      value = this.clock.now();
    } catch {
      throw failure('repository_failed');
    }
    return checkedNow(value);
  }
}
