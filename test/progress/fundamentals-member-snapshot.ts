import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { readLessonSnapshot } from '../../src/fundamentals/state/snapshotCodec';
import { replayRpc } from './api';
import type { RealSession } from './sessions';

export async function memberLessonSnapshot(session: RealSession, asset: DeliveryUnitAsset) {
  const generation = await (
    await replayRpc('/rpc/initialize_learning_state', session.accessToken, {})
  ).json();
  if (typeof generation !== 'number') throw new Error('Invalid server generation.');
  const raw = await (
    await replayRpc('/rpc/load_fundamentals_snapshot', session.accessToken, {
      p_unit_id: asset.unit.id,
      p_content_version: asset.contentVersion,
      p_expected_generation: generation,
    })
  ).json();
  return readLessonSnapshot(raw, asset);
}
