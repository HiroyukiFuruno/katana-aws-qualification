import { profileKey } from './assessment';

export const historyKey = 'saa-study.attempts.v1';
export const legacyExamKey = 'saa-study.exam.v1';
export const examKeyPrefix = 'katana.certification-exam.v1.';
const legacyIncorrectIndex = 'saa-study.incorrect.v1';

export function clearBrowserLearningRecords() {
  const keys = [historyKey, profileKey, legacyIncorrectIndex, legacyExamKey];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(examKeyPrefix)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
  if (keys.some((key) => localStorage.getItem(key) !== null)) {
    throw new Error('学習データの削除を確認できませんでした。');
  }
}
