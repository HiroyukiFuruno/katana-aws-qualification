import { useState } from 'react';
import { AssessmentContentError } from './AssessmentContentError';
import * as assessmentDomain from './assessment';
import { localizeAssessmentItems } from './assessmentLocalization';
import {
  assessmentComplete,
  ensureAssessmentPresentation,
  filterAssessmentProfile,
  orderedItems,
  randomOptionOrders,
} from './assessmentOptionOrder';
import type { AssessmentItem } from './assessmentTypes';
import { AccountBenefits } from './auth/AccountBenefits';
import { usePreferences } from './preferences';
import { RoadmapHeader } from './RoadmapHeader';
import { RoadmapQuestion } from './RoadmapQuestion';
import { RoadmapResults } from './RoadmapResults';
import { RoadmapSetup } from './RoadmapSetup';
import { shuffle } from './randomization';
import { useContent } from './useContent';
import { useRoadmapProfile } from './useRoadmapProfile';

export function Roadmap({ onStudy }: { onStudy: (id: string) => void }) {
  const { t } = usePreferences();
  const { content } = useContent();
  const { profile, persist, saveError, saving } = useRoadmapProfile();
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'questions' | 'result'>('setup');
  const today = assessmentDomain.assessmentDate();
  const remaining = assessmentDomain.remainingCertifications(profile.earned, today);
  const canonicalItems = assessmentDomain.assessmentItems(profile.earned, today);
  let localizedItems: AssessmentItem[];
  try {
    localizedItems = localizeAssessmentItems(
      canonicalItems,
      assessmentDomain.assessment,
      content.assessment,
    );
  } catch {
    return (
      <main className="shell" id="main">
        <AssessmentContentError />
      </main>
    );
  }
  const items = orderedItems(localizedItems, profile.order);
  const estimate = assessmentDomain.assessmentEstimate(items.length);
  const item = items[position];
  const complete = assessmentComplete(items, profile.answers);

  async function enterAssessment() {
    if (complete) {
      setPhase('result');
      return;
    }
    const nextProfile = ensureAssessmentPresentation(profile, items);
    if (!(await persist(nextProfile))) return;
    const nextItems = orderedItems(items, nextProfile.order);
    setPosition(
      Math.max(
        0,
        nextItems.findIndex((question) => profile.answers[question.id] === undefined),
      ),
    );
    setPhase('questions');
  }

  function toggleEarned(id: string, checked: boolean) {
    const earned = checked
      ? [...new Set([...profile.earned, id])]
      : profile.earned.filter((value) => value !== id);
    const remainingItems = new Set(
      assessmentDomain.assessmentItems(earned, today).map((question) => question.id),
    );
    void persist(filterAssessmentProfile(profile, earned, remainingItems));
  }

  function selectAnswer(choice: number) {
    if (!item) return;
    void persist({ ...profile, answers: { ...profile.answers, [item.id]: choice } });
  }

  return (
    <main className="shell" id="main" aria-busy={saving}>
      <RoadmapHeader
        showEstimate={phase === 'setup' && !complete && items.length > 0}
        estimate={estimate}
      />
      {phase !== 'questions' && <AccountBenefits context="assessment" showAction />}
      {saveError && (
        <p className="notice" role="alert">
          {t('assessmentSaveFailed')}
        </p>
      )}
      {phase === 'setup' ? (
        <RoadmapSetup
          earned={profile.earned}
          hasRemaining={remaining.length > 0}
          complete={complete}
          estimate={estimate}
          onToggle={toggleEarned}
          onStart={enterAssessment}
          saving={saving}
        />
      ) : phase === 'questions' && item ? (
        <RoadmapQuestion
          item={item}
          content={content}
          profile={profile}
          position={position}
          total={items.length}
          onSelect={selectAnswer}
          onBack={() => (position ? setPosition(position - 1) : setPhase('setup'))}
          onNext={() => {
            if (position < items.length - 1) setPosition(position + 1);
            else if (complete) setPhase('result');
            else setPosition(items.findIndex((question) => profile.answers[question.id] === undefined));
          }}
          saving={saving}
        />
      ) : (
        <RoadmapResults
          items={items}
          earned={profile.earned}
          answers={profile.answers}
          today={today}
          onStudy={onStudy}
          onEdit={() => setPhase('setup')}
          onRetake={async () => {
            const saved = await persist({
              ...profile,
              answers: {},
              order: shuffle(items.map(({ id }) => id)),
              optionOrders: randomOptionOrders(items),
            });
            if (!saved) return;
            setPosition(0);
            setPhase('questions');
          }}
          saving={saving}
        />
      )}
    </main>
  );
}
