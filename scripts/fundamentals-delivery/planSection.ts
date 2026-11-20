import type { DeliveryQuestion } from '../../src/fundamentals/delivery/artifactTypes';
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
        label: '状況',
        text: section.example.scenario,
      },
      ...section.example.steps.map((text, index) => ({
        contentRef: `section:${section.id}:step:${index}`,
        kind: 'steps' as const,
        label: `手順 ${index + 1}`,
        text,
      })),
      {
        contentRef: `section:${section.id}:outcome`,
        kind: 'outcome',
        label: '結論',
        text: section.example.outcome,
      },
    ],
    complexity: 6,
    id: `${unit.id}:section:${section.id}:example`,
    kind: 'example',
    label: '具体例',
    objectiveIds: ids,
    sectionId: section.id,
    style: 'normal',
  });
  addSlides(target, warnings, unit, {
    blocks: [
      {
        contentRef: `section:${section.id}:misconception:claim`,
        kind: 'misconception',
        label: 'これは誤り',
        text: section.misconception.claim,
      },
      {
        contentRef: `section:${section.id}:misconception:correction`,
        kind: 'correction',
        label: '訂正',
        text: section.misconception.correction,
      },
    ],
    complexity: 6,
    id: `${unit.id}:section:${section.id}:misconception`,
    kind: 'misconception',
    label: 'これは誤りと訂正',
    objectiveIds: ids,
    sectionId: section.id,
    style: 'misconception',
  });
  addSlides(target, warnings, unit, {
    blocks: section.takeaways.map((text, index) => ({
      contentRef: `section:${section.id}:takeaway:${index}`,
      kind: 'takeaway' as const,
      label: '要点',
      text,
    })),
    complexity: 4,
    id: `${unit.id}:section:${section.id}:takeaway`,
    kind: 'takeaway',
    label: '要点',
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
    label: 'checkpoint',
    objectiveIds: ids,
    sectionId: section.id,
    sources: [],
    style: 'assessment',
    unitId: unit.id,
  });
}
