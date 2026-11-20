import { historyKey } from './learningStorage';

export function withHistoryLock<T>(operation: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(historyKey, operation);
  return Promise.resolve().then(operation);
}
