import type {
  DeliveryFinalPolicy,
  DeliveryIndexAsset,
  DeliveryRouteManifest,
  DeliveryUnitAsset,
  TrustedCatalogUnit,
} from '../../src/fundamentals/delivery/artifactTypes';
import type { FundamentalsContent, FundamentalsUnit } from '../../src/fundamentals/types';
import { sha256 } from './hash';
import { buildDeliveryIndex } from './index';
import { buildPlan } from './plan';
import { type CheckpointDocument, normalizeFinals, requireUnits } from './source';
import { segmentationPolicy } from './text';
import { trustedCatalogUnit } from './trusted';

const finalPolicy: DeliveryFinalPolicy = {
  attemptScope: 'current-attempt-only',
  passCorrect: 10,
  questionCount: 12,
  ratio: 0.8,
};

export type DeliveryBundle = {
  index: DeliveryIndexAsset;
  routeManifest: DeliveryRouteManifest;
  trustedCatalog: { schemaVersion: 1; units: TrustedCatalogUnit[] };
  units: DeliveryUnitAsset[];
};

function slug(unitId: string) {
  return unitId.replace(/^fundamentals\./, '');
}

export function contentVersionFor(
  unit: FundamentalsUnit,
  checkpoints: DeliveryUnitAsset['checkpoints'],
  finals: DeliveryUnitAsset['finalQuestions'],
  steps: DeliveryUnitAsset['steps'],
) {
  return sha256({ checkpoints, finals, policy: finalPolicy, segmentationPolicy, steps, unit });
}

export function buildDelivery(
  content: FundamentalsContent,
  checkpoints: CheckpointDocument,
): DeliveryBundle {
  const units = requireUnits(content, checkpoints).map(({ checkpoints, unit }) => {
    const finals = normalizeFinals(unit);
    const plan = buildPlan(unit, checkpoints, finals);
    const contentVersion = contentVersionFor(unit, checkpoints, finals, plan.steps);
    const partial = trustedCatalogUnit(
      unit.id,
      contentVersion,
      '',
      plan.steps,
      checkpoints,
      finals,
      finalPolicy,
    );
    const contentHash = sha256({
      contentVersion: partial.contentVersion,
      finalPolicy: partial.finalPolicy,
      finalQuestions: partial.finalQuestions,
      plan: partial.plan,
      unitId: partial.unitId,
    });
    return {
      checkpoints,
      contentHash,
      contentVersion,
      finalPolicy,
      finalQuestions: finals,
      steps: plan.steps,
      timing: plan.timing,
      totalSteps: plan.steps.length,
      unit: {
        id: unit.id,
        next: unit.next,
        order: unit.order,
        prerequisites: unit.prerequisites,
        title: unit.title,
      },
    };
  });
  const trusted = units.map((unit) =>
    trustedCatalogUnit(
      unit.unit.id,
      unit.contentVersion,
      unit.contentHash,
      unit.steps,
      unit.checkpoints,
      unit.finalQuestions,
      unit.finalPolicy,
    ),
  );
  return {
    index: buildDeliveryIndex(content, units),
    routeManifest: {
      schemaVersion: 1,
      units: units.map((unit) => ({
        contentVersion: unit.contentVersion,
        finalQuestions: unit.finalQuestions.map((question, index) => ({
          position: index + 1,
          questionId: question.id,
        })),
        nonFinalSteps: unit.steps
          .filter((step) => step.kind !== 'final')
          .map((step) => ({
            globalPosition: step.position,
            id: step.id,
            kind: step.kind === 'checkpoint' ? ('checkpoint' as const) : ('slide' as const),
          })),
        slug: slug(unit.unit.id),
        title: unit.unit.title,
        unitId: unit.unit.id,
      })),
    },
    trustedCatalog: { schemaVersion: 1, units: trusted },
    units,
  };
}
