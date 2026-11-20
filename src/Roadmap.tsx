import { useState } from 'react';
import { AssessmentQuestion } from './AssessmentQuestion';
import {
  assessmentDate,
  assessmentEstimate,
  assessmentItems,
  remainingCertifications,
} from './assessment';
import { AccountBenefits } from './auth/AccountBenefits';
import { CertificationDirectory } from './CertificationDirectory';
import { usePreferences } from './preferences';
import { RoadmapResults } from './RoadmapResults';

import { useRoadmapProfile } from './useRoadmapProfile';

export function Roadmap({ onStudy }: { onStudy: (id: string) => void }) {
  const { t } = usePreferences();
  const { profile, persist, saveError } = useRoadmapProfile();
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'questions' | 'result'>('setup');
  const today = assessmentDate();
  const remaining = remainingCertifications(profile.earned, today);
  const items = assessmentItems(profile.earned, today);
  const estimate = assessmentEstimate(items.length);
  const item = items[position];
  const complete =
    items.length > 0 &&
    items.every(
      ({ id, options }) =>
        Number.isInteger(profile.answers[id]) &&
        profile.answers[id] >= 0 &&
        profile.answers[id] <= options.length,
    );

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
    void persist({ earned, answers });
  }

  function selectAnswer(choice: number) {
    void persist({ ...profile, answers: { ...profile.answers, [item.id]: choice } });
  }

  return (
    <main className="shell" id="main">
      <div className="intro">
        <h1>{t('skillsAssessment')}</h1>
        <p>{t('roadmapIntro')}</p>
        {phase === 'setup' && !complete && items.length > 0 && (
          <p>
            <output>
              <strong>{t('assessmentDuration', estimate)}</strong>
            </output>
          </p>
        )}
      </div>
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
              {complete ? t('certOrder') : t('startAssessment', estimate)}
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
            void persist({ ...profile, answers: {} });
            setPosition(0);
            setPhase('questions');
          }}
        />
      )}
    </main>
  );
}
