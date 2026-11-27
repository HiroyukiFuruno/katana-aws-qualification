import { usePreferences } from '../../preferences';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonStep } from '../delivery/slideTypes';
import { LessonAssessment } from './LessonAssessment';
import { LessonReading } from './LessonReading';
import { LessonRelatedReading } from './LessonRelatedReading';
import { lessonFragments } from './lessonFragments';

type Props = {
  step: LessonStep;
  asset: DeliveryUnitAsset;
  optionalObjectives?: readonly LessonStep[];
  question?: DeliveryQuestion;
  selected: string[];
  onChange: (selected: string[]) => void;
  activeFinal: boolean;
  requiredScore: number;
  blocked: boolean;
  feedback: boolean;
  checkpoint: () => Promise<void>;
  retryCheckpoint: () => void;
};

export function LessonStepContent(props: Props) {
  const { t } = usePreferences();
  const { step, question, selected, onChange, blocked } = props;
  if (step.kind === 'final' && !props.activeFinal) {
    return <p>{t('lessonFinalRules', { correct: props.requiredScore, total: 12 })}</p>;
  }
  if (question && step.kind === 'checkpoint') {
    return (
      <>
        <LessonAssessment
          question={question}
          selected={selected}
          onChange={onChange}
          busy={blocked}
          mode="checkpoint"
          feedback={props.feedback ? { submitted: true, correct: question.correct } : undefined}
          onSubmit={props.checkpoint}
          onRetry={props.retryCheckpoint}
        />
        <LessonRelatedReading asset={props.asset} question={question} />
      </>
    );
  }
  if (question && step.kind === 'final') {
    return (
      <>
        <LessonAssessment
          question={question}
          selected={selected}
          onChange={onChange}
          busy={blocked}
          mode="final"
        />
        <LessonRelatedReading asset={props.asset} question={question} />
      </>
    );
  }
  return (
    <>
      <LessonReading step={step} />
      {props.optionalObjectives?.length ? (
        <details className="lesson-related-reading">
          <summary>{props.optionalObjectives[0].label}</summary>
          <ul className="lesson-related-content">
            {props.optionalObjectives.flatMap((objectives) =>
              lessonFragments(objectives).map(({ block, key }) => <li key={key}>{block.text}</li>),
            )}
          </ul>
        </details>
      ) : null}
    </>
  );
}
