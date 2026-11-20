import { expect, test } from 'bun:test';
import type { ExamDraft } from '../src/exam';
import { finalMemberDraft, persistFinalMemberResponse } from '../src/examSubmissionMember';
import { ProgressApiError } from '../src/progress/api';

const key = '["q",1]';
const draft: ExamDraft = {
  deadline: 2_000,
  id: 'exam',
  order: [key],
  position: 0,
  responses: { [key]: { durationMs: 10, flagged: false, selected: ['a'], selectedAt: 1 } },
  revision: 4,
};

test('adopts a response-loss save only when the canonical draft exactly confirms it', async () => {
  const expected = { ...draft.responses[key], durationMs: 17 };
  const confirmed: ExamDraft = {
    ...draft,
    responses: {
      [key]: { ...expected, selectedAt: 2, selectedAtUtc: '2026-11-20T00:00:00.123456+00:00' },
    },
    revision: 5,
  };
  const store = {
    async loadExam() {
      return confirmed;
    },
    async readExamClock() {
      return '2026-11-20T00:00:03.000000+00:00';
    },
    async saveExamResponse() {
      throw new Error('response lost');
    },
  };
  await expect(persistFinalMemberResponse(store, 'saa-c03', draft, key, expected)).resolves.toBe(
    confirmed,
  );
});

test('does not turn a timing rejection into success before the refreshed server deadline', async () => {
  const timing = new ProgressApiError(400, '22023');
  const store = {
    async loadExam() {
      return draft;
    },
    async readExamClock() {
      return '1970-01-01T00:00:01.999Z';
    },
    async saveExamResponse() {
      throw timing;
    },
  };
  await expect(
    persistFinalMemberResponse(store, 'saa-c03', draft, key, { ...draft.responses[key] }),
  ).rejects.toBe(timing);
});

test('uses the unchanged confirmed draft when a final save crosses the server deadline', async () => {
  const timing = new ProgressApiError(400, '22023');
  const store = {
    async loadExam() {
      return draft;
    },
    async readExamClock() {
      return '1970-01-01T00:00:02.000Z';
    },
    async saveExamResponse() {
      throw timing;
    },
  };
  const unsaved = { ...draft.responses[key], durationMs: 17, selected: ['b'] };
  await expect(persistFinalMemberResponse(store, 'saa-c03', draft, key, unsaved)).resolves.toBe(draft);
});

test('rejects a deadline-crossing save when the refreshed draft revision changed', async () => {
  const timing = new ProgressApiError(400, '22023');
  const store = {
    async loadExam() {
      return { ...draft, revision: 5 };
    },
    async readExamClock() {
      return '1970-01-01T00:00:02.000Z';
    },
    async saveExamResponse() {
      throw timing;
    },
  };
  await expect(
    persistFinalMemberResponse(store, 'saa-c03', draft, key, { ...draft.responses[key] }),
  ).rejects.toBe(timing);
});

test('rejects a response loss when the canonical revision or response differs', async () => {
  const lost = new Error('response lost');
  const store = {
    async loadExam() {
      return { ...draft, revision: 5 };
    },
    async readExamClock() {
      return '2026-11-20T00:00:03.000000+00:00';
    },
    async saveExamResponse() {
      throw lost;
    },
  };
  await expect(
    persistFinalMemberResponse(store, 'saa-c03', draft, key, {
      ...draft.responses[key],
      durationMs: 17,
    }),
  ).rejects.toBe(lost);
});

test('an expired submission uses only the confirmed server draft', async () => {
  const confirmed = { ...draft, revision: 5 };
  const store = {
    async loadExam() {
      return confirmed;
    },
    async readExamClock() {
      return '1970-01-01T00:00:03.000Z';
    },
    async saveExamResponse() {
      throw new Error('expired submissions must not save');
    },
  };
  await expect(
    finalMemberDraft(store, 'saa-c03', draft, key, draft.responses[key], 50, draft.deadline),
  ).resolves.toBe(confirmed);
});
