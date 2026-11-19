import { useState } from 'react';
import { AssessmentQuestion } from './AssessmentQuestion';
import { assessmentItems, profileKey, remainingCertifications } from './assessment';
import { AccountBenefits } from './auth/AccountBenefits';
import { CertificationDirectory } from './CertificationDirectory';
import { usePreferences } from './preferences';
import { RoadmapResults } from './RoadmapResults';

import { loadProfile, type Profile } from './roadmapProfile';

export function Roadmap({ onStudy }: { onStudy: (id: string) => void }) {
  const { t } = usePreferences();
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
      {phase !== 'questions' && <AccountBenefits context="assessment" showAction />}
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
        <AssessmentQuestion
          item={item}
          answer={profile.answers[item.id]}
          position={position}
          total={items.length}
          selectAnswer={selectAnswer}
          onBack={() => (position ? setPosition(position - 1) : setPhase('setup'))}
          onNext={() => {
            if (position < items.length - 1) setPosition(position + 1);
            else if (complete) setPhase('result');
            else setPosition(items.findIndex((question) => profile.answers[question.id] === undefined));
          }}
        />
      ) : (
        <RoadmapResults
          items={items}
          earned={profile.earned}
          answers={profile.answers}
          today={today}
          onStudy={onStudy}
          onEdit={() => setPhase('setup')}
          onRetake={() => {
            persist({ ...profile, answers: {} });
            setPosition(0);
            setPhase('questions');
          }}
        />
      )}
    </>
  );
}
