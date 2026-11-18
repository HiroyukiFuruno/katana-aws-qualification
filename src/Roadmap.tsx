import { useState } from 'react';
import { assessmentItems, profileKey, recommend, remainingCertifications } from './assessment';
import { certifications, skills } from './certifications';

type Profile = { earned: string[]; answers: Record<string, number> };

function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey) ?? 'null');
    return {
      earned: Array.isArray(saved?.earned) ? saved.earned.filter((id: unknown) => typeof id === 'string') : [],
      answers: saved?.answers && typeof saved.answers === 'object' ? saved.answers : {},
    };
  } catch {
    return { earned: [], answers: {} };
  }
}

export function Roadmap({ onStudy }: { onStudy: (id: string) => void }) {
  const [profile, setProfile] = useState(loadProfile);
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'questions' | 'result'>('setup');
  const [saveError, setSaveError] = useState(false);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const remaining = remainingCertifications(profile.earned, today);
  const items = assessmentItems(profile.earned, today);
  const item = items[position];
  const complete = items.length > 0 && items.every(({ id, options }) =>
    Number.isInteger(profile.answers[id]) && profile.answers[id] >= 0 && profile.answers[id] <= options.length);

  function persist(next: Profile) {
    setProfile(next);
    try {
      localStorage.setItem(profileKey, JSON.stringify(next));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  function enterAssessment() {
    if (complete) {
      setPhase('result');
      return;
    }
    setPosition(Math.max(0, items.findIndex(question => profile.answers[question.id] === undefined)));
    setPhase('questions');
  }

  function toggleEarned(id: string, checked: boolean) {
    const earned = checked ? [...new Set([...profile.earned, id])] : profile.earned.filter(value => value !== id);
    const remainingItems = new Set(assessmentItems(earned, today).map(question => question.id));
    const answers = Object.fromEntries(Object.entries(profile.answers).filter(([question]) => remainingItems.has(question)));
    persist({ earned, answers });
  }

  function selectAnswer(choice: number) {
    persist({ ...profile, answers: { ...profile.answers, [item.id]: choice } });
  }

  return <>
    {saveError && <p className="notice" role="alert">査定の進捗をブラウザに保存できませんでした。</p>}
    {phase === 'setup' ? <>
      <section className="card roadmap-card">
        <h2>取得済みの資格</h2>
        <p>取得済みの資格にチェックを入れると、査定・取得順の対象から外れます。残りの資格にも共通する分野は出題されます。</p>
        <div className="cert-grid">
          {certifications.map(cert => <label className="cert-check" key={cert.id}>
            <input type="checkbox" checked={profile.earned.includes(cert.id)}
              onChange={event => toggleEarned(cert.id, event.target.checked)} />
            <span><strong>{cert.name}</strong><small>{cert.id.toUpperCase()} · {cert.level}{cert.beta ? ' · ベータ' : ''}</small></span>
          </label>)}
        </div>
        {remaining.length ? <button className="primary" onClick={enterAssessment}>
          {complete ? '取得順を見る' : `スキル査定へ（${items.length}問）`}
        </button> : <p role="status">取得順の対象となる未取得資格はありません。</p>}
      </section>
      <section className="card roadmap-card">
        <h2>学習・模試</h2>
        {certifications.filter(cert => cert.course).map(cert =>
          <button key={cert.id} onClick={() => onStudy(cert.id)}>{cert.id.toUpperCase()}の教材を開く</button>)}
      </section>
    </> : phase === 'questions' && item ? <section className="card roadmap-card">
      <p className="eyebrow">{skills[item.skill]} · {position + 1} / {items.length}</p>
      <h2>{item.prompt}</h2>
      <fieldset>
        <legend className="sr-only">回答選択肢</legend>
        {item.options.map((option, index) => <label className="choice choice-wrap" key={option}>
          <input type="radio" name={item.id} checked={profile.answers[item.id] === index}
            onChange={() => selectAnswer(index)} />{option}
        </label>)}
        <label className="choice choice-wrap"><input type="radio" name={item.id}
          checked={profile.answers[item.id] === item.options.length}
          onChange={() => selectAnswer(item.options.length)} />分からない</label>
      </fieldset>
      <div className="exam-actions">
        <button onClick={() => position ? setPosition(position - 1) : setPhase('setup')}>戻る</button>
        <button className="primary" disabled={profile.answers[item.id] === undefined}
          onClick={() => {
            if (position < items.length - 1) setPosition(position + 1);
            else if (complete) setPhase('result');
            else setPosition(items.findIndex(question => profile.answers[question.id] === undefined));
          }}>{position === items.length - 1 ? '査定結果を見る' : '次の問題へ'}</button>
      </div>
    </section> : <>
      <section className="card roadmap-card">
        <h2>査定結果</h2>
        <p className="exam-score">{items.filter(item => profile.answers[item.id] === item.correct).length} / {items.length} 問正解</p>
        <details className="exam-solutions">
          <summary>設問ごとの正誤と正解を見る</summary>
          <ol className="roadmap-results">
            {items.map(item => {
              const chosen = profile.answers[item.id];
              const correct = chosen === item.correct;
              const answer = chosen === item.options.length ? '分からない' : item.options[chosen] ?? '未回答';
              return <li key={item.id}>
                <strong className={correct ? 'good-text' : 'bad-text'}>{correct ? '○ 正解' : '× 不正解'}</strong>
                <p>{item.prompt}</p>
                <p>あなたの回答 · {answer}</p>
                {!correct && <p>正解 · {item.options[item.correct]}</p>}
              </li>;
            })}
          </ol>
        </details>
      </section>
      <section className="card roadmap-card">
        <h2>おすすめの取得順</h2>
        <p>分野別の正答状況、試験レベル、学習内容の重なりをもとに並べています。近く終了する試験は、関連分野に十分正答できた場合に優先します。</p>
        <ol className="roadmap-results">
          {recommend(profile.earned, profile.answers, today).map(({ cert, gaps, priority }) =>
            <li key={cert.id}>
              <strong>{cert.name} · {cert.level}</strong> <small>{cert.id.toUpperCase()}{cert.beta ? ' · ベータ' : ''}</small>
              <p>学習範囲 · {cert.focus}</p>
              <p>{gaps.length ? '復習する分野 · ' + gaps.map(skill => skills[skill]).join('、') : '査定した関連分野は全問正答'}
                {priority > 0 && ' · 終了日が近いため優先'}
                {cert.retireOn && ` · 試験終了予定 ${cert.retireOn}`}
              </p>
              {cert.buildsOn && <p>先に学ぶとつながる資格 · {cert.buildsOn.map(id => id.toUpperCase()).join('、')}</p>}
              {cert.course ? <button onClick={() => onStudy(cert.id)}>教材を開く</button> : <small>教材は準備中</small>}
            </li>)}
        </ol>
        <p>少数の設問による学習順の目安です。表示順は受験の必須条件や合格判定を示すものではありません。</p>
        <div className="exam-actions">
          <button onClick={() => setPhase('setup')}>取得済み資格を編集</button>
          <button onClick={() => { persist({ ...profile, answers: {} }); setPosition(0); setPhase('questions'); }}>査定をやり直す</button>
        </div>
      </section>
    </>}
  </>;
}
