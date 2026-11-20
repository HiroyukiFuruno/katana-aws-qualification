import type {
  DeliveryIndexAsset,
  DeliveryUnitAsset,
} from '../../src/fundamentals/delivery/artifactTypes';
import type { FundamentalsContent } from '../../src/fundamentals/types';

export function buildDeliveryIndex(
  content: FundamentalsContent,
  assets: DeliveryUnitAsset[],
): DeliveryIndexAsset {
  const byId = new Map(assets.map((asset) => [asset.unit.id, asset]));
  return {
    schemaVersion: 1,
    units: content.catalog.map((catalog) => {
      const asset = byId.get(catalog.id);
      if (!asset) throw new Error(`Missing delivery asset: ${catalog.id}`);
      if (asset.unit.order !== catalog.order)
        throw new Error(`Delivery catalog mismatch: ${catalog.id}`);
      return {
        checkpointCount: asset.checkpoints.length,
        checkpointIds: asset.checkpoints.map((question) => question.id),
        contentHash: asset.contentHash,
        contentVersion: asset.contentVersion,
        finalQuestionCount: asset.finalQuestions.length,
        finalQuestionIds: asset.finalQuestions.map((question) => question.id),
        minutes: Math.ceil(asset.timing.totalSeconds / 60),
        next: asset.unit.next,
        objective: catalog.objective,
        order: catalog.order,
        parent: catalog.parent,
        prerequisiteIds: [...catalog.prerequisiteIds],
        slug: asset.unit.id.replace(/^fundamentals\./, ''),
        state: catalog.state,
        title: catalog.title,
        totalSteps: asset.totalSteps,
        unitId: catalog.id,
      };
    }),
  };
}
