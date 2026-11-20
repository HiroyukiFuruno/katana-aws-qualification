export async function discardChangedOwner(
  remove: (commandId: string, allowStaleOwner?: boolean) => Promise<void>,
  commandId: string,
  error: unknown,
) {
  try {
    await remove(commandId, true);
  } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], 'Unable to remove stale lesson command');
  }
  throw error;
}
