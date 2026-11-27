import type { LessonRecordAsset } from '../delivery/recordAsset';
import type { MemberLessonRepository } from './memberTypes';
import type { LessonAssetResolver, LessonCommand } from './outboxTypes';

export async function resolveLessonAsset(resolver: LessonAssetResolver, command: LessonCommand) {
  const asset = await resolver(command.unitId, command.contentVersion);
  if (!asset || asset.unit.id !== command.unitId || asset.contentVersion !== command.contentVersion) {
    throw new Error('Unknown lesson outbox asset');
  }
  return asset;
}

export function invokeLessonCommand(
  repository: Pick<MemberLessonRepository, 'recordStep' | 'startFinal' | 'saveResponse' | 'finalize'>,
  asset: LessonRecordAsset,
  command: LessonCommand,
) {
  if (command.kind === 'recordStep') return repository.recordStep(asset, command.input);
  if (command.kind === 'startFinal') return repository.startFinal(asset, command.input);
  if (command.kind === 'saveResponse') return repository.saveResponse(asset, command.input);
  return repository.finalize(asset, command.input);
}
