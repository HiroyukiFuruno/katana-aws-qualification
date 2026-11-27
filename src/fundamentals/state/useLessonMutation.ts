import { useEffect, useRef, useState } from 'react';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonCommand } from './outboxTypes';
import type { LessonServices } from './services';
import type { LessonSnapshot } from './types';

type Pending = {
  command: LessonCommand;
  done: (snapshot: LessonSnapshot) => void;
  followUp?: (snapshot: LessonSnapshot, completed: LessonCommand) => LessonCommand | undefined;
};

export function useLessonMutation(
  services: LessonServices,
  asset: DeliveryUnitAsset,
  onConfirmed?: (snapshot: LessonSnapshot) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [pending, setPendingState] = useState<Pending>();
  const pendingRef = useRef<Pending | undefined>(undefined);
  const setPending = (next: Pending | undefined) => {
    pendingRef.current = next;
    setPendingState(next);
  };
  const locked = useRef(false);
  const current = useRef(true);
  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
    };
  }, []);
  async function run(operation: Pending) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    setPending(operation);
    try {
      let completed = operation.command;
      let result = await services.execute(asset, completed);
      onConfirmed?.(result);
      while (operation.followUp && current.current) {
        const command = operation.followUp(result, completed);
        if (!command) break;
        setPending({ ...operation, command });
        completed = command;
        result = await services.execute(asset, completed);
        onConfirmed?.(result);
      }
      if (!current.current) return;
      setPending(undefined);
      operation.done(result);
    } catch (cause) {
      if (current.current) setError(cause);
    } finally {
      locked.current = false;
      if (current.current) setBusy(false);
    }
  }
  return {
    busy,
    error,
    pending: Boolean(pending),
    getPendingCommand: () => pendingRef.current?.command,
    execute: (command: LessonCommand, done: Pending['done'], followUp?: Pending['followUp']) =>
      run({ command, done, followUp }),
    retry: async () => {
      if (pending) await run(pending);
    },
    async discard() {
      if (locked.current) return;
      if (pending) await services.outbox?.discard(pending.command.commandId);
      if (current.current) {
        setPending(undefined);
        setError(undefined);
      }
    },
  };
}
