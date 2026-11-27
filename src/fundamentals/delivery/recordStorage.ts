import { lessonRecordPrefix } from '../../learningStorage';
import { type LessonRecordAsset, readLessonRecordAsset, toLessonRecordAsset } from './recordAsset';

type RecordStorage = Pick<Storage, 'getItem' | 'setItem'>;

function recordKey(unitId: string, contentVersion: string) {
  return `${lessonRecordPrefix}${unitId}.${contentVersion}`;
}

export function storedLessonRecord(
  storage: Pick<RecordStorage, 'getItem'>,
  unitId: string,
  contentVersion: string,
) {
  const raw = storage.getItem(recordKey(unitId, contentVersion));
  return raw === null ? undefined : readLessonRecordAsset(JSON.parse(raw), unitId, contentVersion);
}

export function retainLessonRecord(storage: RecordStorage, asset: LessonRecordAsset) {
  const key = recordKey(asset.unit.id, asset.contentVersion);
  const serialized = JSON.stringify(toLessonRecordAsset(asset));
  if (storage.getItem(key) === serialized) return;
  storage.setItem(key, serialized);
  if (storage.getItem(key) !== serialized) throw new Error('Lesson history data was not saved.');
}
