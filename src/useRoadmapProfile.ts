import { useEffect, useState } from 'react';
import { useProgress } from './progress/ProgressProvider';
import { loadProfile, type Profile, saveProfile } from './roadmapProfile';

function ownerKey(store: ReturnType<typeof useProgress>['store']) {
  const owner = store?.getSnapshot().owner;
  return owner
    ? `${owner.kind}:${owner.generation}:${owner.kind === 'member' ? owner.userId : ''}`
    : 'none';
}

export function useRoadmapProfile() {
  const { status, store } = useProgress();
  const snapshot = store?.getSnapshot();
  const owner = ownerKey(store);
  const profileRevision = snapshot?.profileRevision;
  const [profile, setProfile] = useState(loadProfile);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (status !== 'ready' || !store) return;
    const current = store.getSnapshot();
    if (owner !== ownerKey(store) || profileRevision !== current.profileRevision) return;
    setProfile(current.profile);
    setSaveError(false);
  }, [owner, profileRevision, status, store]);
  async function persist(next: Profile) {
    const expectedStore = store;
    if (status !== 'ready' || !expectedStore) {
      setSaveError(true);
      return;
    }
    try {
      await saveProfile(next, expectedStore);
      setProfile(next);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }
  return { persist, profile, saveError };
}
