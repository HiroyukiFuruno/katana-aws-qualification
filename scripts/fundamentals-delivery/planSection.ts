import type { DeliveryQuestion } from '../../src/fundamentals/delivery/artifactTypes';
import labels from '../../src/fundamentals/delivery-labels.json' with { type: 'json' };
import type { FundamentalsSection, FundamentalsUnit } from '../../src/fundamentals/types';
import { addSlides, assessmentSeconds, objectiveIds, type RawStep } from './planSupport';
import type { TextWarning } from './text';

export function addSectionSteps(
  target: RawStep[],
  warnings: TextWarning[],
  unit: FundamentalsUnit,
  section: FundamentalsSection,
  checkpoints: DeliveryQuestion[],
) {
  const ids = objectiveIds(unit, section.id);
  addSlides(target, warnings, unit, {
    blocks: section.paragraphs.map((text, index) => ({
      contentRef: `section:${section.id}:paragraph:${index}`,
      kind: 'paragraph' as const,
      label: section.title,
      text,
    })),
    id: `${unit.id}:section:${section.id}:concept`,
    kind: 'reading',
    label: section.title,
    objectiveIds: ids,
    sectionId: section.id,
    style: 'normal',
  });
  addSlides(target, warnings, unit, {
    blocks: [
      {
        contentRef: `section:${section.id}:scenario`,
        kind: 'scenario',
        label: labels.scenario,
        text: section.example.scenario,
      },
      ...section.example.steps.map((text, index) => ({
        contentRef: `section:${section.id}:step:${index}`,
        kind: 'steps' as const,
        label: labels.step.replace('{index}', String(index + 1)),
        text,
      })),
      {
        contentRef: `section:${section.id}:outcome`,
        kind: 'outcome',
        label: labels.outcome,
        text: section.example.outcome,
      },
    ],
    complexity: 6,
    id: `${unit.id}:section:${section.id}:example`,
    kind: 'example',
    label: labels.example,
    objectiveIds: ids,
    sectionId: section.id,
    style: 'normal',
  });
  addSlides(target, warnings, unit, {
    blocks: [
      {
        contentRef: `section:${section.id}:misconception:claim`,
        kind: 'misconception',
        label: labels.misconception,
        text: section.misconception.claim,
      },
      {
        contentRef: `section:${section.id}:misconception:correction`,
        kind: 'correction',
        label: labels.correction,
        text: section.misconception.correction,
      },
    ],
    complexity: 6,
    id: `${unit.id}:section:${section.id}:misconception`,
    kind: 'misconception',
    label: labels.misconceptionAndCorrection,
    objectiveIds: ids,
    sectionId: section.id,
    style: 'misconception',
  });
  addSlides(target, warnings, unit, {
    blocks: section.takeaways.map((text, index) => ({
      contentRef: `section:${section.id}:takeaway:${index}`,
      kind: 'takeaway' as const,
      label: labels.takeaway,
      text,
    })),
    complexity: 4,
    id: `${unit.id}:section:${section.id}:takeaway`,
    kind: 'takeaway',
    label: labels.takeaway,
    objectiveIds: ids,
    sectionId: section.id,
    sources: [section.source],
    style: 'normal',
  });
  const checkpoint = checkpoints.find((item) => item.sectionId === section.id);
  if (!checkpoint) throw new Error(`${unit.id} checkpoint is missing.`);
  target.push({
    assessmentId: checkpoint.id,
    blocks: [],
    estimatedSeconds: assessmentSeconds(checkpoint, 35),
    id: `${unit.id}:checkpoint:${checkpoint.id}`,
    kind: 'checkpoint',
    // 公開済み教材のハッシュ互換性を保ち、表示名はUI辞書で解決する。
    label: labels.checkpoint,
    objectiveIds: ids,
    sectionId: section.id,
    sources: [],
    style: 'assessment',
    unitId: unit.id,
  });
}
