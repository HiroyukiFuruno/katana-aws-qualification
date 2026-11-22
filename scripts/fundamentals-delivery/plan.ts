import type { DeliveryQuestion } from '../../src/fundamentals/delivery/artifactTypes';
import labels from '../../src/fundamentals/delivery-labels.json' with { type: 'json' };
import type { FundamentalsUnit } from '../../src/fundamentals/types';
import { addSectionSteps } from './planSection';
import { addSlides, assessmentSeconds, complete, type RawStep, timings } from './planSupport';
import type { TextWarning } from './text';

function addIntroSteps(target: RawStep[], warnings: TextWarning[], unit: FundamentalsUnit) {
  addSlides(target, warnings, unit, {
    blocks: [
      { contentRef: 'unit:summary', kind: 'summary', label: labels.summary, text: unit.summary },
      { contentRef: 'unit:objective', kind: 'objective', label: labels.objective, text: unit.objective },
    ],
    id: `${unit.id}:intro:orientation`,
    kind: 'intro',
    label: labels.unitOverview,
    style: 'normal',
  });
  addSlides(target, warnings, unit, {
    blocks: (unit.learningObjectives ?? []).map((objective) => ({
      contentRef: `objective:${objective.id}`,
      kind: 'objective' as const,
      label: labels.learningObjectives,
      text: objective.text,
    })),
    id: `${unit.id}:intro:objectives`,
    kind: 'intro',
    label: labels.learningObjectives,
    style: 'normal',
  });
}

function addFinalSteps(target: RawStep[], unit: FundamentalsUnit, finals: DeliveryQuestion[]) {
  for (const question of finals) {
    target.push({
      assessmentId: question.id,
      blocks: [],
      estimatedSeconds: assessmentSeconds(question, 40),
      id: `${unit.id}:final:${question.id}`,
      kind: 'final',
      label: labels.finalReview,
      objectiveIds: question.objectiveId ? [question.objectiveId] : [],
      sectionId: question.sectionId,
      sources: [],
      style: 'assessment',
      unitId: unit.id,
    });
  }
}

export function buildPlan(
  unit: FundamentalsUnit,
  checkpoints: DeliveryQuestion[],
  finals: DeliveryQuestion[],
) {
  const warnings: TextWarning[] = [];
  const raw: RawStep[] = [];
  addIntroSteps(raw, warnings, unit);
  for (const section of unit.sections ?? []) addSectionSteps(raw, warnings, unit, section, checkpoints);
  addFinalSteps(raw, unit, finals);
  const steps = complete(raw);
  return { steps, timing: timings(steps), warnings };
}
