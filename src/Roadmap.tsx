import { usePreferences } from './preferences';
import { useState } from 'react';
import { assessmentItems, profileKey, recommend, remainingCertifications } from './assessment';
import { CertificationDirectory } from './CertificationDirectory';
import { levelMessage, skills } from './certifications';

type Profile = { earned: string[]; answers: Record<string, number> };

function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey) ?? 'null');
    return {
      earned: Array.isArray(saved?.earned)
        ? saved.earned
            .filter((id: unknown): id is string => typeof id === 'string')
            .map((id: string) => (id === 'sap-c02' ? 'sap-c03' : id))
        : [],
      answers: saved?.answers && typeof saved.answers === 'object' ? saved.answers : {},
    };
  } catch {
    return { earned: [], answers: {} };
  }
}

export function Roadmap({ onStudy }: { onStudy: (id: string) => void }) {
  const { t, locale } = usePreferences();
  const [profile, setProfile] = useState(loadProfile);
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'questions' | 'result'>('setup');
  const [saveError, setSaveError] = useState(false);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const remaining = remainingCertifications(profile.earned, today);
  const items = assessmentItems(profile.earned, today);
  const item = items[position];
  const complete =
    items.length > 0 &&
    items.every(
      ({ id, options }) =>
        Number.isInteger(profile.answers[id]) &&
        profile.answers[id] >= 0 &&
        profile.answers[id] <= options.length,
    );

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
    setPosition(
      Math.max(
        0,
        items.findIndex((question) => profile.answers[question.id] === undefined),
      ),
    );
    setPhase('questions');
  }

  function toggleEarned(id: string, checked: boolean) {
    const earned = checked
      ? [...new Set([...profile.earned, id])]
      : profile.earned.filter((value) => value !== id);
    const remainingItems = new Set(assessmentItems(earned, today).map((question) => question.id));
    const answers = Object.fromEntries(
      Object.entries(profile.answers).filter(([question]) => remainingItems.has(question)),
    );
    persist({ earned, answers });
  }

  function selectAnswer(choice: number) {
    persist({ ...profile, answers: { ...profile.answers, [item.id]: choice } });
  }

  return (
    <>
      {saveError && (
        <p className="notice" role="alert">
          {t('assessmentSaveFailed')}
        </p>
      )}
      {phase === 'setup' ? (
        <section className="card roadmap-card">
          <h2>{t('earned')}</h2>
          <p>{t('earnedIntro')}</p>
          <CertificationDirectory mode="earned" selected={profile.earned} onToggle={toggleEarned} />
          {remaining.length ? (
            <button type="button" className="primary" onClick={enterAssessment}>
              {complete ? t('certOrder') : t('startAssessment', { count: items.length })}
            </button>
          ) : (
            <p role="status">{t('allEarned')}</p>
          )}
        </section>
      ) : phase === 'questions' && item ? (
        <section className="card roadmap-card">
          <p className="eyebrow">
            {skills[item.skill]} · {position + 1} / {items.length}
          </p>
          <h2 lang="ja">{item.prompt}</h2>
          {locale !== 'ja' && <p>{t('contentLanguage')}</p>}
          <fieldset>
            <legend className="sr-only">{t('choices')}</legend>
            {item.options.map((option, index) => (
              <label className="choice choice-wrap" key={option}>
                <input
                  type="radio"
                  name={item.id}
                  checked={profile.answers[item.id] === index}
                  onChange={() => selectAnswer(index)}
                />
                <span lang="ja">{option}</span>
              </label>
            ))}
            <label className="choice choice-wrap">
              <input
                type="radio"
                name={item.id}
                checked={profile.answers[item.id] === item.options.length}
                onChange={() => selectAnswer(item.options.length)}
              />
              {t('unknown')}
            </label>
          </fieldset>
          <div className="exam-actions">
            <button
              type="button"
              onClick={() => (position ? setPosition(position - 1) : setPhase('setup'))}
            >
              {t('back')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={profile.answers[item.id] === undefined}
              onClick={() => {
                if (position < items.length - 1) setPosition(position + 1);
                else if (complete) setPhase('result');
                else
                  setPosition(items.findIndex((question) => profile.answers[question.id] === undefined));
              }}
            >
              {position === items.length - 1 ? t('viewAssessment') : t('next')}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="card roadmap-card">
            <h2>{t('assessmentResults')}</h2>
            <p className="exam-score">
              {t('score', {
                correct: items.filter((item) => profile.answers[item.id] === item.correct).length,
                total: items.length,
              })}
            </p>
            <details className="exam-solutions">
              <summary>{t('viewAnswers')}</summary>
              <ol className="roadmap-results">
                {items.map((item) => {
                  const chosen = profile.answers[item.id];
                  const correct = chosen === item.correct;
                  const answer =
                    chosen === item.options.length
                      ? t('unknown')
                      : (item.options[chosen] ?? t('unanswered'));
                  return (
                    <li key={item.id}>
                      <strong className={correct ? 'good-text' : 'bad-text'}>
                        {correct ? `○ ${t('correct')}` : `× ${t('incorrect')}`}
                      </strong>
                      <p>{item.prompt}</p>
                      <p>
                        {t('yourAnswer')} · {answer}
                      </p>
                      {!correct && (
                        <p>
                          {t('correct')} · {item.options[item.correct]}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </details>
          </section>
          <section className="card roadmap-card">
            <h2>{t('recommended')}</h2>
            <p>{t('recommendedIntro')}</p>
            <ol className="roadmap-results">
              {recommend(profile.earned, profile.answers, today).map(({ cert, gaps, priority }) => (
                <li key={cert.id}>
                  <strong>
                    {cert.name} · {t(levelMessage[cert.level])}
                  </strong>{' '}
                  <small>
                    {cert.id.toUpperCase()}
                    {cert.beta ? ` · ${t('beta')}` : ''}
                  </small>
                  <p>
                    {t('studyScope')} · {cert.focus}
                  </p>
                  <p>
                    {gaps.length
                      ? `${t('reviewTopics')} · ${gaps.map((skill) => skills[skill]).join('、')}`
                      : t('allTopicsCorrect')}
                    {priority > 0 && ` · ${t('retirementPriority')}`}
                    {cert.retireOn && ` · ${t('retirement', { date: cert.retireOn })}`}
                  </p>
                  {cert.buildsOn && (
                    <p>
                      {t('relatedCerts')} · {cert.buildsOn.map((id) => id.toUpperCase()).join('、')}
                    </p>
                  )}
                  {cert.course ? (
                    <button type="button" onClick={() => onStudy(cert.id)}>
                      {t('openCourse')}
                    </button>
                  ) : (
                    <small>{t('coursePending')}</small>
                  )}
                </li>
              ))}
            </ol>
            <p>{t('roadmapScope')}</p>
            <div className="exam-actions">
              <button type="button" onClick={() => setPhase('setup')}>
                {t('editEarned')}
              </button>
              <button
                type="button"
                onClick={() => {
                  persist({ ...profile, answers: {} });
                  setPosition(0);
                  setPhase('questions');
                }}
              >
                {t('retakeAssessment')}
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
