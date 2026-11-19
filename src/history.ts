import { isCorrectAnswer, questionKey, type Question } from './questions';

export type Mode = 'study' | 'review';
export type Attempt = {
  schemaVersion: 1;
  questionId: string;
  questionRevision: number;
  category: string;
  sourceVersion: string;
  answeredAt: string;
  selected: string[];
  correct: string[];
  format?: Question['format'];
  isCorrect: boolean;
  durationMs: number;
  attemptNumber: number;
  priorIncorrectCount: number;
  mode: Mode | 'exam';
  examId?: string;
  reviewCorrect: boolean | null;
  reward: 0 | 1;
};

export const historyKey = 'saa-study.attempts.v1';
const legacyExamKey = 'saa-study.exam.v1';
const examKeyPrefix = 'katana.certification-exam.v1.';
export function examKeyFor(certificationId: string) {
  return certificationId === 'saa-c03' ? legacyExamKey : examKeyPrefix + certificationId;
}
const wrongKey = 'saa-study.incorrect.v1';
const cookieName = 'saa_study_incorrect_v1';

export function readHistory(): Attempt[] {
  const raw = localStorage.getItem(historyKey);
  if (raw === null) return [];
  const history: Attempt[] = JSON.parse(raw);
  if (!Array.isArray(history)) throw new Error('学習履歴を読み込めませんでした。');
  return history;
}

function readCookie() {
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
}

function syncIncorrectIds(history: Attempt[]) {
  const ids = [
    ...new Set(history.filter((attempt) => !attempt.isCorrect).map((attempt) => attempt.questionId)),
  ];
  if (!ids.length) return;
  const cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(ids))}`;
  let stored = false;
  try {
    if (cookie.length <= 3800) {
      document.cookie =
        cookie +
        '; Path=/; Max-Age=31536000; SameSite=Lax' +
        (location.protocol === 'https:' ? '; Secure' : '');
      stored = readCookie() === cookie;
    }
    if (!stored) document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // The detailed history remains authoritative when cookies are blocked.
  }
  if (stored) localStorage.removeItem(wrongKey);
  else localStorage.setItem(wrongKey, JSON.stringify(ids));
}

export function withHistoryLock<T>(operation: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(historyKey, operation);
  return Promise.resolve().then(operation);
}

export function statsFor(history: Attempt[], question: Question) {
  const attempts = history.filter(
    (a) => questionKey({ id: a.questionId, revision: a.questionRevision }) === questionKey(question),
  );
  return {
    total: attempts.length,
    wrong: attempts.filter((attempt) => !attempt.isCorrect).length,
    lastReview: attempts.findLast((attempt) => attempt.mode === 'review'),
  };
}

function makeAttempt(
  history: Attempt[],
  question: Question,
  selected: string[],
  mode: Attempt['mode'],
  durationMs: number,
  answeredAt: string,
  examId?: string,
): Attempt {
  const stats = statsFor(history, question);
  const correct = question.correct;
  const isCorrect = isCorrectAnswer(question, selected);
  return {
    schemaVersion: 1,
    questionId: question.id,
    questionRevision: question.revision,
    category: question.category,
    sourceVersion: question.version,
    answeredAt,
    selected,
    correct,
    ...(question.format ? { format: question.format } : {}),
    isCorrect,
    durationMs,
    attemptNumber: stats.total + 1,
    priorIncorrectCount: stats.wrong,
    mode,
    reviewCorrect: mode === 'review' ? isCorrect : null,
    reward: isCorrect ? 1 : 0,
    ...(examId === undefined ? {} : { examId }),
  };
}

function persist(history: Attempt[]) {
  localStorage.setItem(historyKey, JSON.stringify(history));
  try {
    syncIncorrectIds(history);
    return false;
  } catch {
    return true;
  }
}

export function saveAttempt(question: Question, selected: string[], mode: Mode, durationMs: number) {
  return withHistoryLock(() => {
    const history = readHistory();
    const attempt = makeAttempt(history, question, selected, mode, durationMs, new Date().toISOString());
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
  return withHistoryLock(() => {
    try {
      document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
      if (readCookie()) throw new Error('誤答Cookieを削除できませんでした。');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error;
    }
    const keys = [wrongKey, historyKey, legacyExamKey];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(examKeyPrefix)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
    if (keys.some((key) => localStorage.getItem(key) !== null)) {
      throw new Error('学習データの削除を確認できませんでした。');
    }
  });
}

export function exportHistory(history: Attempt[]) {
  const data = history.map((attempt) => JSON.stringify(attempt)).join('\n');
  const url = URL.createObjectURL(new Blob([`${data}\n`], { type: 'application/x-ndjson' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'saa-study-history.jsonl';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
