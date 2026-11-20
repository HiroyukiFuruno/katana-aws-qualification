import { expect, test } from 'bun:test';
import { buildDelivery } from './fundamentals-delivery/build';
import { checkpoints, content, required } from './fundamentals-delivery.fixture';

test('builds deterministic delivery assets without losing published learning content', () => {
  const first = buildDelivery(content, checkpoints);
  const second = buildDelivery(content, checkpoints);
  expect(first).toEqual(second);
  expect(first.index.units).toHaveLength(12);
  expect(first.routeManifest.units).toHaveLength(12);
  expect(first.trustedCatalog.units).toHaveLength(12);
  expect(first.units.flatMap((unit) => unit.checkpoints)).toHaveLength(48);
  expect(first.units.flatMap((unit) => unit.finalQuestions)).toHaveLength(144);

  for (const unit of content.units) {
    const asset = first.units.find((item) => item.unit.id === unit.id);
    const route = first.routeManifest.units.find((item) => item.unitId === unit.id);
    const trusted = first.trustedCatalog.units.find((item) => item.unitId === unit.id);
    expect(asset).toBeDefined();
    expect(route).toBeDefined();
    expect(trusted).toBeDefined();
    if (!asset || !route || !trusted) continue;
    expect(asset.contentVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.contentHash).not.toBe(asset.contentVersion);
    expect(asset.steps).toHaveLength(asset.totalSteps);
    expect(asset.totalSteps).toBeGreaterThanOrEqual(39);
    expect(asset.totalSteps).toBeLessThanOrEqual(43);
    expect(new Set(asset.steps.map((step) => step.id)).size).toBe(asset.steps.length);
    expect(asset.finalPolicy).toEqual({
      attemptScope: 'current-attempt-only',
      passCorrect: 10,
      questionCount: 12,
      ratio: 0.8,
    });
    expect(asset.finalQuestions.map((question) => question.id)).toEqual(
      unit.questions.map((question) => question.id),
    );
    expect(asset.checkpoints).toHaveLength(4);
    expect(asset.steps.filter((step) => step.kind === 'checkpoint')).toHaveLength(4);
    expect(route.nonFinalSteps).toHaveLength(asset.totalSteps - 12);
    expect(route.finalQuestions).toHaveLength(12);
    expect(trusted.plan).toHaveLength(asset.totalSteps - 12);
    expect(trusted.finalQuestions).toHaveLength(12);
    expect(trusted.contentVersion).toBe(asset.contentVersion);
    expect(trusted.contentHash).toBe(asset.contentHash);
    expect(asset.checkpoints).toEqual(
      expect.arrayContaining(
        (unit.sections ?? []).map((section) =>
          expect.objectContaining({
            category: unit.id,
            revision: 1,
            title: section.title,
            unitId: unit.id,
            version: '2026-11-learning',
          }),
        ),
      ),
    );
    expect(asset.finalQuestions.map((question) => question.source)).toEqual(
      unit.questions.map((question) => question.source),
    );
    for (const section of unit.sections ?? []) {
      const checkpointQuestion = required(
        asset.checkpoints.find((question) => question.sectionId === section.id),
        'checkpoint question',
      );
      expect(checkpointQuestion).toMatchObject({
        category: unit.id,
        revision: 1,
        title: section.title,
        unitId: unit.id,
        version: '2026-11-learning',
      });
      const checkpoint = asset.steps.findIndex(
        (step) => step.kind === 'checkpoint' && step.sectionId === section.id,
      );
      const reading = asset.steps
        .map((step, index) => ({ index, step }))
        .filter(
          ({ step }) =>
            step.sectionId === section.id && step.kind !== 'checkpoint' && step.kind !== 'final',
        )
        .map(({ index }) => index);
      expect(checkpoint).toBeGreaterThan(Math.max(...reading));
      const text = asset.steps
        .flatMap((step) => step.blocks)
        .filter((block) => block.contentRef.startsWith(`section:${section.id}:`))
        .map((block) => block.text)
        .join('');
      expect(text).toContain(section.paragraphs.join(''));
      expect(text).toContain(section.example.scenario);
      expect(text).toContain(section.example.outcome);
      expect(text).toContain(section.misconception.claim);
      expect(text).toContain(section.misconception.correction);
      expect(text).toContain(section.takeaways.join(''));
      expect(
        asset.steps.some((step) => step.sources.some((source) => source.url === section.source.url)),
      ).toBe(true);
    }
    for (const objective of unit.learningObjectives ?? [])
      expect(
        asset.steps
          .flatMap((step) => step.blocks)
          .map((block) => block.text)
          .join(''),
      ).toContain(objective.text);
  }
  const forms = new Map<string, number>();
  for (const question of first.units.flatMap((unit) => unit.finalQuestions)) {
    const form = `${question.selectionPolarity}:${question.requiredChoices === 1 ? 'single' : 'multiple'}`;
    forms.set(form, (forms.get(form) ?? 0) + 1);
  }
  expect(new Set(forms.keys())).toEqual(
    new Set(['correct:single', 'correct:multiple', 'incorrect:single', 'incorrect:multiple']),
  );
  expect([...forms.values()]).toEqual([36, 36, 36, 36]);
});

test('rejects a checkpoint that does not match its unit section and objective', () => {
  const invalid = structuredClone(checkpoints);
  required(required(invalid.units[0], 'checkpoint unit').checkpoints[0], 'checkpoint').sectionId =
    'missing';
  expect(() => buildDelivery(content, invalid)).toThrow('checkpoint');
});
