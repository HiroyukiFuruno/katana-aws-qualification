import { SiteFooter } from "./SiteFooter";
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { certifications, type Course } from './certifications';
import { Roadmap } from './Roadmap';
import { QuestionSetPicker, type QuestionSet } from './QuestionSetPicker';
import { shuffle } from './exam';
import { ExamMode } from './ExamMode';
import { QuestionCard } from './QuestionCard';
import { examKeyFor, exportHistory, historyKey, readHistory, resetHistory, saveAttempt, statsFor, type Attempt, type Mode } from './history';
import { loadQuestions, questionKey, type Question } from './questions';
import './style.css';

type Page = Mode | 'exam' | 'settings';
type Session = { questions: Question[]; index: number; correct: number };

function Settings({ count, onReset, onExport }: { count: number; onReset: () => Promise<void>; onExport: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  async function confirmReset() {
    setBusy(true);
    dialog.current?.close();
    try {
      await onReset();
    } finally {
      setBusy(false);
    }
  }

  return <section className="card">
    <h2>学習データ</h2>
    <p>保存済みの回答 {count} 件。JSONLは1行に1回答を記録します。</p>
    <button className="primary" disabled={!count || busy} onClick={onExport}>JSONLをダウンロード</button>
    <hr />
    <h3>履歴と進捗の初期化</h3>
    <p>このブラウザに保存した回答履歴、誤答、復習結果、模擬試験の解答と途中経過を、全資格分まとめて削除します。</p>
    <button className="danger" disabled={busy} onClick={() => dialog.current?.showModal()}>学習データをリセット</button>
    <dialog ref={dialog} aria-labelledby="reset-title">
      <h2 id="reset-title">学習データを削除しますか？</h2>
      <p>回答履歴と復習状況が初期化されます。この操作は取り消せません。</p>
      <div className="dialog-actions">
        <button autoFocus onClick={() => dialog.current?.close()}>キャンセル</button>
        <button className="danger" onClick={() => void confirmReset()}>削除する</button>
      </div>
    </dialog>
  </section>;
}

function CourseApp({ id, course, onHome }: { id: string; course: Course; onHome: () => void }) {
  const [practiceSets, setPracticeSets] = useState<{ label: string; questions: Question[] }[]>([]);
  const questions = practiceSets.flatMap(set => set.questions);
  const questionSets: QuestionSet[] = practiceSets.flatMap(set => {
    const size = course.setSize;
    if (!size) return [set];
    return Array.from({ length: Math.ceil(set.questions.length / size) }, (_, index) => ({
      label: `${set.label} 第${index + 1}回`,
      questions: set.questions.slice(index * size, (index + 1) * size),
    }));
  });
  const randomBank = [...new Map(questions.map(question => [questionKey(question), question])).values()];

  const [mockBank, setMockBank] = useState<Question[]>([]);
  const [archivedBank, setArchivedBank] = useState<Question[]>([]);
  const [mockError, setMockError] = useState('');
  const [history, setHistory] = useState<Attempt[]>([]);
  const [page, setPage] = useState<Page>('study');
  const [session, setSession] = useState<Session>();
  const [loadingError, setLoadingError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const question = session?.questions[session.index];
  const knownQuestions = new Map([...questions, ...mockBank].map(question => [questionKey(question), question]));
  const courseIds = new Set([...knownQuestions.values(), ...archivedBank].map(question => question.id));
  const courseHistory = history.filter(attempt => courseIds.has(attempt.questionId));
  const summaries = [...knownQuestions.values()].map(question => ({ question, ...statsFor(courseHistory, question) }));
  const review = summaries.filter(stats => stats.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong);
  const rate = courseHistory.length ? Math.round(100 * courseHistory.filter(a => a.isCorrect).length / courseHistory.length) + '%' : '—';

  useEffect(() => {
    const banks = new Map<string, Promise<Question[]>>();
    function load(path: string) {
      const cached = banks.get(path);
      if (cached) return cached;
      const request = loadQuestions(path);
      banks.set(path, request);
      return request;
    }
    Promise.all(course.practice.map(async ({ path, label }) => ({ label, questions: await load(path) })))
      .then(setPracticeSets).catch(error => setLoadingError(error.message));
    Promise.all([load(course.mock), Promise.all(course.archives.map(load))])
      .then(([current, archived]) => {
        setMockBank(current);
        setArchivedBank(archived.flat());
      })
      .catch(error => setMockError(error.message));
    function refresh() {
      try {
        setHistory(readHistory());
      } catch {
        setNotice('ブラウザの学習履歴を読み込めませんでした。');
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === historyKey || event.key === null) {
        refresh();
        if (event.newValue === null) setSession(undefined);
      }
    }
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [course]);

  const pages = [['study', '学習'], ['exam', '模擬試験'], ['review', '誤答復習'], ['settings', '設定']] as const;
  const start = (items: Question[]) => setSession({ questions: items, index: 0, correct: 0 });

  async function answer(selected: string[], elapsed: number) {
    if (!question || (page !== 'study' && page !== 'review')) throw new Error('出題がありません。');
    setBusy(true);
    try {
      const result = await saveAttempt(question, selected, page, elapsed);
      setHistory(result.history);
      setSession(current => current && ({ ...current, correct: current.correct + result.attempt.reward }));
      if (result.indexFailed) setNotice('回答履歴は保存されましたが、誤答IDの一覧を更新できませんでした。');
      return result.attempt;
    } finally {
      setBusy(false);
    }
  }

  function updateExamHistory(updated: Attempt[], indexFailed: boolean) {
    setHistory(updated);
    if (indexFailed) setNotice('回答履歴は保存されましたが、誤答IDの一覧を更新できませんでした。');
  }

  async function reset() {
    setBusy(true);
    try {
      await resetHistory();
      setHistory([]);
      setSession(undefined);
      setPage('study');
      setNotice('学習データをリセットしました。');
    } catch {
      setNotice('学習データの削除を確認できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    try {
      const current = readHistory().filter(attempt => courseIds.has(attempt.questionId));
      if (current.length) exportHistory(current);
    } catch {
      setNotice('エクスポート用の学習履歴を読み込めませんでした。');
    }
  }

  return <>
    <header><div className="shell topbar"><a className="brand" href="./" onClick={event => { event.preventDefault(); if (!busy) onHome(); }}>KatanA<span> AWS</span></a>
      <nav aria-label="学習メニュー">{pages.map(([id, label]) =>
        <button key={id} disabled={busy} aria-current={page === id ? 'page' : undefined}
          onClick={() => { if (page !== id) { setPage(id); setSession(undefined); setNotice(''); } }}>{label}</button>)}</nav>
    </div></header>
    <main className="shell">
      <div className="intro"><p className="eyebrow">AWS CERTIFICATION / {id.toUpperCase()}</p>
        <h1>{pages.find(([id]) => page === id)?.[1]}</h1>
        {page === 'study' && <p>設問に答えたあと、選択肢ごとの技術的根拠を確認できます。</p>}
        {page === 'review' && <p>累計誤答回数が多い設問から出題します。</p>}
      </div>
      <div className="metrics" aria-label="学習進捗">
        <div><span>回答数</span><strong>{courseHistory.length}</strong></div>
        <div><span>正答率</span><strong>{rate}</strong></div>
        <div><span>誤答した現行設問</span><strong>{review.length}</strong></div>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {page === 'settings' ? <Settings count={courseHistory.length} onReset={reset} onExport={download} /> :
        page === 'exam' ? mockError || loadingError ? <p role="alert">{mockError || loadingError}</p> :
          mockBank.length && questions.length ? <ExamMode sets={questionSets} examKey={examKeyFor(id)} blueprint={course.exam} bank={mockBank} archivedBank={archivedBank} history={history} onSaved={updateExamHistory} /> :
            <p role="status">模擬試験の問題を読み込んでいます。</p> :
        loadingError ? <p className="notice" role="alert">{loadingError}</p> :
        !questions.length ? <p role="status">問題を読み込んでいます。</p> :
        session && question ? <>
          <div className="progress"><span>第 {session.index + 1} 問 / {session.questions.length} 問</span>
            <progress max={session.questions.length} value={session.index + 1} aria-label="出題位置" /></div>
          <QuestionCard key={questionKey(question)} question={question} onAnswer={answer}
            last={session.index + 1 === session.questions.length}
            onNext={() => setSession(current => current && ({ ...current, index: current.index + 1 }))} />
        </> : session ? <section className="card"><h2>今回の結果</h2>
          <p>{session.questions.length}問中 {session.correct}問正解</p>
          <button className="primary" onClick={() => setSession(undefined)}>{page === 'review' ? '復習一覧に戻る' : '演習一覧に戻る'}</button>
        </section> : page === 'review' ? <section className="card">
          <h2>復習対象</h2>
          {review.length ? <>
            <ol className="review-list">{review.map(({ question, wrong, lastReview }) =>
              <li key={questionKey(question)}><span>{question.title}</span><span>誤答 {wrong}回 · {lastReview ? (lastReview.isCorrect ? '前回復習 正解' : '前回復習 不正解') : '未復習'}</span></li>)}</ol>
            <button className="primary" onClick={() => start(review.map(item => item.question))}>復習を始める</button>
          </> : <p>現在の問題セットに誤答履歴はありません。</p>}
        </section> : <section className="card">
          <h2>問題セット</h2>
          <QuestionSetPicker bank={randomBank} sets={questionSets} buttonLabel="学習を始める"
            onStart={(count, fixed) => start(fixed?.questions ?? shuffle(randomBank).slice(0, count))} />
          <p><a href="https://aws.amazon.com/certification/certification-prep/" target="_blank" rel="noreferrer">AWS公式の練習問題・模試</a></p>
        </section>}
    </main>
  </>;
}

function App() {
  const [courseId, setCourseId] = useState<string>();
  const selected = certifications.find(cert => cert.id === courseId);
  useEffect(() => { window.scrollTo(0, 0); }, [courseId]);
  return <>
    {selected?.course ? <CourseApp key={selected.id} id={selected.id}
      course={selected.course} onHome={() => setCourseId(undefined)} /> : <>
    <header><div className="shell topbar"><a className="brand" href="./">KatanA<span> AWS</span></a></div></header>
    <main className="shell">
      <div className="intro"><p className="eyebrow">AWS CERTIFICATION</p>
        <h1>資格ロードマップ</h1>
        <p>分野別の理解度を確認し、AWS資格をどの順番で取得するか決める。</p>
      </div>
      <Roadmap onStudy={setCourseId} />
    </main>
    </>}
    <SiteFooter />
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
