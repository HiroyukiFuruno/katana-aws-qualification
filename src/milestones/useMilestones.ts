import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressApiError } from '../progress/api';
import type { MilestoneApi, MilestoneSnapshot, MilestonesModel, MilestonesNotice } from './modelTypes';
import type { Milestone } from './types';

type State = {
  epoch: object;
  snapshot?: MilestoneSnapshot;
  loading: boolean;
  notice: MilestonesNotice;
};

export function useMilestones(api: MilestoneApi | null): MilestonesModel | null {
  const [reload, setReload] = useState(0);
  const epoch = useMemo(() => ({ api, reload }), [api, reload]);
  const current = useRef<typeof epoch | null>(epoch);
  current.current = epoch;
  const busy = useRef<object | null>(null);
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    current.current = epoch;
    const client = epoch.api;
    if (!client) return;
    let active = true;
    setState({ epoch, loading: true, notice: 'idle' });
    void client.load().then(
      (snapshot) => {
        if (active && current.current === epoch)
          setState({ epoch, snapshot, loading: false, notice: 'idle' });
      },
      () => {
        if (active && current.current === epoch)
          setState({ epoch, loading: false, notice: 'load-error' });
      },
    );
    return () => {
      active = false;
      if (current.current === epoch) current.current = null;
    };
  }, [epoch]);

  const visible = state?.epoch === epoch ? state : null;
  const loading = !visible || visible.loading;
  const notice = visible?.notice ?? 'idle';
  const disabled = loading || ['saving', 'load-error', 'save-error', 'conflict'].includes(notice);

  async function execute(
    operation: (snapshot: MilestoneSnapshot) => Promise<Milestone[]>,
  ): Promise<boolean> {
    const snapshot = visible?.snapshot;
    if (!snapshot || disabled || current.current !== epoch || busy.current === epoch) return false;
    busy.current = epoch;
    setState({ epoch, snapshot, loading: false, notice: 'saving' });
    try {
      const items = await operation(snapshot);
      if (current.current !== epoch) return false;
      setState({ epoch, snapshot: { ...snapshot, items }, loading: false, notice: 'saved' });
      return true;
    } catch (error) {
      if (current.current !== epoch) return false;
      const conflict =
        error instanceof ProgressApiError && ['PT409', 'PT412', '23505'].includes(error.code ?? '');
      setState({
        epoch,
        snapshot,
        loading: false,
        notice: conflict ? 'conflict' : 'save-error',
      });
      return false;
    } finally {
      if (busy.current === epoch) busy.current = null;
    }
  }

  if (!api) return null;
  return {
    items: visible?.snapshot?.items ?? [],
    loading,
    disabled,
    notice,
    reload: () => setReload((value) => value + 1),
    save: (input, revision) =>
      execute(async (snapshot) => {
        const saved = await api.save(input, revision, snapshot.generation);
        return [...snapshot.items.filter(({ id }) => id !== saved.id), saved];
      }),
    remove: (row) =>
      execute(async (snapshot) => {
        await api.remove(row.id, row.revision, snapshot.generation);
        return snapshot.items.filter(({ id }) => id !== row.id);
      }),
  };
}
