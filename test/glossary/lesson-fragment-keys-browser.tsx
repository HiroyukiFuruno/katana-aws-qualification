import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { loadDeliveryIndex } from '../../src/fundamentals/delivery/loadIndex';
import { loadDeliveryUnit } from '../../src/fundamentals/delivery/loadUnit';
import type { LessonStep } from '../../src/fundamentals/delivery/slideTypes';
import { LessonReading } from '../../src/fundamentals/learner/LessonReading';
import { LessonRelatedReading } from '../../src/fundamentals/learner/LessonRelatedReading';

const params = new URLSearchParams(location.search);
const unitId = params.get('unit');
const stepId = params.get('step');
const related = params.get('renderer') === 'related';
if (!unitId || !stepId) throw new Error('The regression requires a published unit and step.');
const published = await loadDeliveryUnit(await loadDeliveryIndex(), unitId);
const original = published.steps.find((step) => step.id === stepId);
if (!original) throw new Error('Missing published target step.');
const target =
  params.get('repeat') === 'true'
    ? { ...original, blocks: [...original.blocks, original.blocks[0]] }
    : original;
const asset = {
  ...published,
  steps: published.steps.map((step) => (step.id === target.id ? target : step)),
};
const adjacent = asset.steps.find(
  (step) => step.blocks.length && step.sectionId && step.sectionId !== target?.sectionId,
);
if (!target || !adjacent) throw new Error('Missing published reading steps.');

function FragmentRegression({
  asset,
  target,
  adjacent,
}: {
  asset: DeliveryUnitAsset;
  target: LessonStep;
  adjacent: LessonStep;
}) {
  const [current, setCurrent] = useState(target);
  const [revision, setRevision] = useState(0);
  const question = asset.checkpoints.find((question) => question.sectionId === current.sectionId);
  if (!question) throw new Error('Missing published checkpoint for the reading section.');
  return (
    <>
      <nav>
        <button type="button" onClick={() => setCurrent(adjacent)}>
          Adjacent step
        </button>
        <button type="button" onClick={() => setCurrent(target)}>
          Target step
        </button>
        <button type="button" onClick={() => setRevision(revision + 1)}>
          Rerender
        </button>
      </nav>
      <main data-step={current.id} data-revision={revision}>
        {related ? (
          <LessonRelatedReading asset={asset} question={question} />
        ) : (
          <LessonReading step={current} />
        )}
      </main>
    </>
  );
}

const container = document.getElementById('fragment-root');
if (!container) throw new Error('Missing regression root.');
createRoot(container).render(<FragmentRegression asset={asset} target={target} adjacent={adjacent} />);
