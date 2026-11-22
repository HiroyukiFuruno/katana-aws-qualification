import { AssessmentQuestion } from './AssessmentQuestion';
import { validOptionOrder } from './assessmentOptionOrder';
import type { AssessmentItem } from './assessmentTypes';
import type { SiteContent } from './contentTypes';
import type { Profile } from './roadmapProfile';

export function RoadmapQuestion({
  item,
  content,
  profile,
  position,
  total,
  onSelect,
  onBack,
  onNext,
  saving,
}: {
  item: AssessmentItem;
  content: SiteContent;
  profile: Profile;
  position: number;
  total: number;
  onSelect: (choice: number) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <AssessmentQuestion
      item={item}
      skillLabel={content.skills[item.skill]}
      answer={profile.answers[item.id]}
      position={position}
      total={total}
      choiceOrder={
        validOptionOrder(profile.optionOrders[item.id], item.options.length)
          ? profile.optionOrders[item.id]
          : [...item.options.keys(), item.options.length]
      }
      selectAnswer={onSelect}
      onBack={onBack}
      onNext={onNext}
      saving={saving}
    />
  );
}
