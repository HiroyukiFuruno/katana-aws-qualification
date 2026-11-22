import { type RandomSource, shuffle } from '../../randomization';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonStep } from '../delivery/slideTypes';

const randomizedPresentationVersion = '8';

export function createRandomizedFinalSessionId() {
  const id = crypto.randomUUID();
  return `${id.slice(0, 14)}${randomizedPresentationVersion}${id.slice(15)}`;
}

export function stepQuestionPresentation(
  asset: DeliveryUnitAsset,
  step: LessonStep,
  sessionId: string | undefined,
  position: number,
) {
  const presentedFinal =
    step.kind === 'final' ? presentedFinalQuestion(asset, sessionId, position) : undefined;
  const question =
    step.kind === 'final'
      ? presentedFinal?.question
      : asset.checkpoints.find((item) => item.id === step.assessmentId);
  return { presentedFinal, question };
}

function seededRandom(seed: string): RandomSource {
  let state = 2_166_136_261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16_777_619);
  }
  return () => {
    state += 1_836_568_581;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function presentedQuestion(question: DeliveryQuestion, seed: string): DeliveryQuestion {
  return { ...question, choices: shuffle(question.choices, seededRandom(seed)) };
}

export type PresentedFinalQuestion = {
  canonicalPosition: number;
  question: DeliveryQuestion;
};

export function presentedFinalQuestion(
  asset: DeliveryUnitAsset,
  sessionId: string | undefined,
  position: number,
) {
  return sessionId ? finalPresentation(asset, sessionId)[position] : undefined;
}

export function finalPresentation(
  asset: DeliveryUnitAsset,
  sessionId: string,
): PresentedFinalQuestion[] {
  if (!usesRandomizedPresentation(sessionId)) {
    return asset.finalQuestions.map((question, canonicalPosition) => ({ canonicalPosition, question }));
  }
  const positions = shuffle(
    asset.finalQuestions.map((_, position) => position),
    seededRandom(`${asset.contentVersion}:${sessionId}:questions`),
  );
  return positions.map((canonicalPosition) => {
    const question = asset.finalQuestions[canonicalPosition];
    if (!question) throw new Error('A lesson final question is missing.');
    return {
      canonicalPosition,
      question: presentedQuestion(question, `${asset.contentVersion}:${sessionId}:${question.id}`),
    };
  });
}

function usesRandomizedPresentation(sessionId: string) {
  // UUIDv8 は提示方式v1を永続的に表す。将来方式は別のマーカーを使い、既存v8を再解釈しない。
  return sessionId[14] === randomizedPresentationVersion && /^[89ab]$/i.test(sessionId[19] ?? '');
}
