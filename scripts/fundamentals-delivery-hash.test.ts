import { expect, test } from 'bun:test';
import { buildDelivery, contentVersionFor } from './fundamentals-delivery/build';
import { canonicalJson, sha256 } from './fundamentals-delivery/hash';
import { checkpoints, content, required } from './fundamentals-delivery.fixture';

test('changes the version and catalog hashes when published source text changes', () => {
  const edited = structuredClone(content);
  const section = required(required(edited.units[0], 'unit').sections?.[0], 'section');
  section.paragraphs[0] = `${required(section.paragraphs[0], 'paragraph')}。`;
  const original = required(buildDelivery(content, checkpoints).units[0], 'original delivery');
  const revised = required(buildDelivery(edited, checkpoints).units[0], 'revised delivery');
  expect(revised.contentVersion).not.toBe(original.contentVersion);
  expect(revised.contentHash).not.toBe(original.contentHash);
});

test('versions include the generated semantic plan and canonical JSON omits only object undefined values', () => {
  const unit = required(content.units[0], 'unit');
  const asset = required(buildDelivery(content, checkpoints).units[0], 'delivery');
  const regrouped = structuredClone(asset.steps);
  const firstStep = required(regrouped[0], 'step');
  firstStep.id = `${firstStep.id}:regrouped`;
  expect(contentVersionFor(unit, asset.checkpoints, asset.finalQuestions, regrouped)).not.toBe(
    asset.contentVersion,
  );
  const canonical = canonicalJson({ nested: { value: 1 }, omitted: undefined });
  expect(canonicalJson(JSON.parse(canonical))).toBe(canonical);
  expect(sha256({ omitted: undefined })).toBe(sha256({}));
  expect(() => canonicalJson([undefined])).toThrow('Undefined');
  expect(() => canonicalJson(Number.NaN)).toThrow('Non-finite');
});
