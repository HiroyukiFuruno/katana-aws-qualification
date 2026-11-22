import { expect, test } from 'bun:test';
import { filterAssessmentProfile } from '../src/assessmentOptionOrder';
import type { Profile } from '../src/progress/profileTypes';

function expectPresentationContract(profile: Profile) {
  expect(Object.keys(profile.optionOrders).every((id) => profile.order.includes(id))).toBeTrue();
}

test('filters an in-progress assessment without producing an invalid presentation payload', () => {
  const profile: Profile = {
    earned: ['old-cert'],
    answers: { removed: 1, retained: 2 },
    optionOrders: { removed: [3, 2, 1, 0], retained: [2, 0, 3, 1] },
    order: ['removed', 'retained'],
  };

  const filtered = filterAssessmentProfile(profile, ['new-cert'], new Set(['retained', 'added']));

  expect(filtered).toEqual({
    earned: ['new-cert'],
    answers: { retained: 2 },
    optionOrders: { retained: [2, 0, 3, 1] },
    order: ['retained'],
  });
  expectPresentationContract(filtered);
  expect(profile).toEqual({
    earned: ['old-cert'],
    answers: { removed: 1, retained: 2 },
    optionOrders: { removed: [3, 2, 1, 0], retained: [2, 0, 3, 1] },
    order: ['removed', 'retained'],
  });
});

test('repairs legacy empty presentation order while retaining remaining answers and choices', () => {
  const filtered = filterAssessmentProfile(
    {
      earned: [],
      answers: { removed: 1, retained: 0 },
      optionOrders: { removed: [0, 1, 2, 3], retained: [1, 3, 0, 2] },
      order: [],
    },
    ['earned-cert'],
    new Set(['retained', 'added']),
  );

  expect(filtered).toEqual({
    earned: ['earned-cert'],
    answers: { retained: 0 },
    optionOrders: { retained: [1, 3, 0, 2] },
    order: ['retained'],
  });
  expectPresentationContract(filtered);
});
