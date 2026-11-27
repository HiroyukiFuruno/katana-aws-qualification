import { readLessonRecordAsset } from './recordAsset';

export async function legacyLessonRecord(unitId: string, contentVersion: string) {
  const { legacyRecordAssets } = await import('./legacyRecordData');
  const asset = legacyRecordAssets.assets.find(
    (asset) => asset.unit.id === unitId && asset.contentVersion === contentVersion,
  );
  return asset && readLessonRecordAsset(asset, unitId, contentVersion);
}
