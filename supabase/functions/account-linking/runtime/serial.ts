/** 同一 storage instance の mutation 順序だけを保証し、worker 間の排他は DB guard の責務とする。 */
export class RuntimeMutationQueue {
  private tail = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.tail.then(operation, operation);
    this.tail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }
}
