import { useEffect, useRef, useState } from 'react';
import { getActiveProgressStore } from './history';
import { useProgress } from './progress/ProgressProvider';
import { loadProfile, type Profile, saveProfile } from './roadmapProfile';
import { RoadmapProfileSaveGuard } from './roadmapProfileSaveGuard';

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
  const storeProfile = snapshot?.profile;
  const [profile, setProfile] = useState(loadProfile);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const guard = useRef(new RoadmapProfileSaveGuard());
  useEffect(() => {
    guard.current.invalidate(owner, store, setSaving);
  }, [owner, store]);
  useEffect(() => {
    if (status !== 'ready' || !store) return;
    const current = store.getSnapshot();
    if (
      owner !== ownerKey(store) ||
      profileRevision !== current.profileRevision ||
      current.profile !== storeProfile
    )
      return;
    setProfile(storeProfile);
    setSaveError(false);
  }, [owner, profileRevision, status, store, storeProfile]);
  async function persist(next: Profile) {
    const expectedStore = store;
    if (status !== 'ready' || !expectedStore) {
      setSaveError(true);
      return false;
    }
    try {
      const saved = await guard.current.run(() => saveProfile(next, expectedStore), setSaving);
      if (!saved.accepted || !saved.current) return false;
      if (expectedStore !== getActiveProgressStore() || owner !== ownerKey(expectedStore)) return false;
      setProfile(next);
      setSaveError(false);
      return true;
    } catch {
      if (expectedStore === getActiveProgressStore() && owner === ownerKey(expectedStore))
        setSaveError(true);
      return false;
    }
  }
  return { persist, profile, saveError, saving };
}
