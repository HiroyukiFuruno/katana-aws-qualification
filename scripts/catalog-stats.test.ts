import { expect, test } from 'bun:test';
import type { Course } from '../src/certificationTypes.ts';
import { catalogStats } from './catalog-stats.ts';

test('counts current study and mock banks by certification and omits archived questions', () => {
  const exam = { minutes: 2, distribution: { sample: 1 } };
  const first: Course = {
    exam,
    mock: 'mock',
    practice: [
      { path: 'mock', label: 'saaFull' },
      { path: 'practice', label: 'study' },
    ],
    archives: ['archive'],
  };
  const second: Course = { exam, mock: 'second-mock', practice: [], archives: [] };
  const readBanks = [];
  const banks = {
    mock: [{ id: 'one' }, { id: 'two', similarityGroup: 'concept' }],
    practice: [{ id: 'one' }, { id: 'three', similarityGroup: 'concept' }, { id: 'four' }],
    'second-mock': [{ id: 'one' }],
  };

  const totals = catalogStats([{ course: first }, {}, { course: second }], (path) => {
    readBanks.push(path);
    return banks[path as keyof typeof banks];
  });

  expect(totals).toEqual({ certifications: 2, questions: 4 });
  expect(readBanks).toEqual(['mock', 'practice', 'second-mock']);
});
