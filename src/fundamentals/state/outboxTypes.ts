import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { MemberLessonRepository } from './memberTypes';
import type { LessonSnapshot } from './types';

export type LessonCommand =
  | {
      commandId: string;
      contentVersion: string;
      input: Parameters<MemberLessonRepository['recordStep']>[1];
      kind: 'recordStep';
      unitId: string;
    }
  | {
      commandId: string;
      contentVersion: string;
      input: Parameters<MemberLessonRepository['startFinal']>[1];
      kind: 'startFinal';
      unitId: string;
    }
  | {
      commandId: string;
      contentVersion: string;
      input: Parameters<MemberLessonRepository['saveResponse']>[1];
      kind: 'saveResponse';
      unitId: string;
    }
  | {
      commandId: string;
      contentVersion: string;
      input: Parameters<MemberLessonRepository['finalize']>[1];
      kind: 'finalize';
      unitId: string;
    };

export type LessonOutboxStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
export type LessonOutboxScope = Pick<LessonCommand, 'unitId' | 'contentVersion'>;
export type LessonOutbox = {
  clear(): Promise<void>;
  discard(commandId: string): Promise<void>;
  discardUnit(unitId: string, contentVersion: string): Promise<void>;
  execute(asset: DeliveryUnitAsset, command: LessonCommand): Promise<LessonSnapshot>;
  flush(scope?: LessonOutboxScope): Promise<void>;
  hasPending(scope?: LessonOutboxScope): boolean;
  initialize(): Promise<void>;
};

export type LessonAssetResolver = (
  unitId: string,
  contentVersion: string,
) => DeliveryUnitAsset | Promise<DeliveryUnitAsset | undefined> | undefined;
