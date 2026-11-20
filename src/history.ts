import { type Attempt, type Mode, makeAttempt } from './attempts';
import {
  clearBrowserLearningRecords,
  examKeyPrefix,
  historyKey,
  legacyExamKey,
} from './learningStorage';
import type { ProgressStore } from './progress/storeTypes';
import type { Question } from './questions';

export { historyKey } from './learningStorage';

export { type Attempt, type Mode, statsFor } from './attempts';
export { exportHistory } from './historyExport';

const legacyIncorrectCookie = 'saa_study_incorrect_v1';
let activeProgressStore: ProgressStore | null | undefined;

export function setActiveProgressStore(store: ProgressStore | null | undefined) {
  activeProgressStore = store;
}

export function getActiveProgressStore() {
  return activeProgressStore;
}

function progressStore(expected: ProgressStore | null | undefined) {
  if (expected !== undefined && expected !== activeProgressStore) {
    throw new Error('学習記録の保存先が切り替わりました。');
  }
  if (expected === null || activeProgressStore === null) {
    throw new Error('学習記録の保存先を初期化中です。');
  }
  return expected ?? activeProgressStore;
}
export function examKeyFor(certificationId: string) {
  return certificationId === 'saa-c03' ? legacyExamKey : examKeyPrefix + certificationId;
}

export function readHistory(expectedStore?: ProgressStore | null): Attempt[] {
  const store = progressStore(expectedStore);
  if (store) {
    const snapshot = store.getSnapshot();
    if (snapshot.state !== 'ready') throw new Error('学習履歴を読み込めませんでした。');
    return snapshot.attempts;
  }
  const raw = localStorage.getItem(historyKey);
  if (raw === null) return [];
  const history: Attempt[] = JSON.parse(raw);
  if (!Array.isArray(history)) throw new Error('学習履歴を読み込めませんでした。');
  return history;
}

export function withHistoryLock<T>(operation: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(historyKey, operation);
  return Promise.resolve().then(operation);
}

export function expireLegacyIncorrectCookie() {
  try {
    document.cookie = `${legacyIncorrectCookie}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error;
  }
}

function persist(history: Attempt[]) {
  localStorage.setItem(historyKey, JSON.stringify(history));
  return false;
}

export function saveAttempt(
  question: Question,
  selected: string[],
  mode: Mode,
  durationMs: number,
  certificationId?: string,
  expectedStore?: ProgressStore | null,
) {
  return withHistoryLock(() => {
    const history = readHistory(expectedStore);
    const answeredAt = new Date().toISOString();
    const makeCurrentAttempt = (current: Attempt[]) =>
      makeAttempt(current, question, selected, mode, durationMs, answeredAt);
    const attempt = makeCurrentAttempt(history);
    const store = progressStore(expectedStore);
    if (store) {
      if (store.getSnapshot().owner.kind === 'member' && !certificationId) {
        throw new Error('資格IDなしに学習記録を同期できません。');
      }
      return store
        .appendAttempt(certificationId ?? 'guest', attempt, makeCurrentAttempt)
        .then((saved) => ({ attempt: saved, history: readHistory(store), indexFailed: false }));
    }
    const updated = [...history, attempt];
    return { attempt, history: updated, indexFailed: persist(updated) };
  });
}

export function saveExam(
  examKey: string,
  id: string,
  deadline: number,
  answers: { question: Question; selected: string[]; durationMs: number; selectedAt?: number }[],
) {
  return withHistoryLock(() => {
    const history = readHistory();
    const previous = history.filter((attempt) => attempt.examId === id);
    if (previous.length) return { attempts: previous, history, indexFailed: false };
    const draft = localStorage.getItem(examKey);
    if (!draft || JSON.parse(draft).id !== id) throw new Error('受験データが更新されました。');
    const submittedAt = Math.min(Date.now(), deadline);
    const attempts = answers.map(({ question, selected, durationMs, selectedAt }) =>
      makeAttempt(
        history,
        question,
        selected,
        'exam',
        durationMs,
        new Date(selectedAt ?? submittedAt).toISOString(),
        id,
      ),
    );
    const updated = [...history, ...attempts];
    return { attempts, history: updated, indexFailed: persist(updated) };
  });
}

export function resetHistory() {
  if (activeProgressStore === null) throw new Error('学習記録の保存先を初期化中です。');
  if (activeProgressStore) {
    const owner = activeProgressStore.getSnapshot().owner;
    return activeProgressStore.reset().then(() => {
      if (owner.kind === 'guest') {
        expireLegacyIncorrectCookie();
        clearBrowserLearningRecords();
      }
    });
  }
  return withHistoryLock(() => {
    expireLegacyIncorrectCookie();
    clearBrowserLearningRecords();
  });
}
