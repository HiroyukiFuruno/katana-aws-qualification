import { expect, test } from 'bun:test';
import { exitLesson } from '../src/fundamentals/learner/exitLesson';

function fixture() {
  let saves = 0,
    leaves = 0,
    current = true,
    durable = false;
  const input = {
    busy: false,
    final: false,
    pending: false,
    hasDurablePending: () => durable,
    isCurrent: () => current,
    save: async () => {
      saves++;
      current = false;
    },
    leave: () => {
      leaves++;
    },
  };
  return {
    input,
    counts: () => [saves, leaves],
    durable: () => {
      durable = true;
    },
  };
}

test('reading exits without advancing or saving a step, while an in-flight operation cannot be interrupted', async () => {
  const f = fixture();
  f.input.busy = true;
  await exitLesson(f.input);
  expect(f.counts()).toEqual([0, 0]);
  f.input.busy = false;
  await exitLesson(f.input);
  expect(f.counts()).toEqual([0, 1]);
});

test('final exit uses successful save navigation once and never submits a result', async () => {
  const f = fixture();
  f.input.final = true;
  await exitLesson(f.input);
  expect(f.counts()).toEqual([1, 0]);
});

test('a stale screen cannot save or navigate after its owner or route changes', async () => {
  const f = fixture();
  f.input.final = true;
  f.input.isCurrent = () => false;
  await exitLesson(f.input);
  expect(f.counts()).toEqual([0, 0]);
});

test('durably queued final work survives an exit without replaying or discarding it', async () => {
  const f = fixture();
  f.input.final = true;
  f.input.pending = true;
  f.durable();
  await exitLesson(f.input);
  expect(f.counts()).toEqual([0, 1]);
});

test('a final answer that was not retained cannot be silently abandoned as saved', async () => {
  const f = fixture();
  f.input.final = true;
  f.input.pending = true;
  await expect(exitLesson(f.input)).rejects.toThrow('could not be retained');
  expect(f.counts()).toEqual([0, 0]);
  f.input.pending = false;
  f.input.save = async () => {
    f.durable();
  };
  await exitLesson(f.input);
  expect(f.counts()).toEqual([0, 1]);
});
