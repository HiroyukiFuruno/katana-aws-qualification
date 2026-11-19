import type { Attempt } from '../attempts';
import { usePreferences } from '../preferences';
import { QuestionCard } from '../QuestionCard';
import { FundamentalsLesson } from './FundamentalsLesson';
import type { FundamentalsQuestion, FundamentalsUnit } from './types';

type Props = {
  unit: FundamentalsUnit;
  question: FundamentalsQuestion;
  current: number;
  total: number;
  last: boolean;
  onNext(): void;
  onAnswer(selected: string[], elapsed: number): Promise<Attempt>;
};

export function FundamentalsPractice({ unit, question, current, total, last, onNext, onAnswer }: Props) {
  const { t } = usePreferences();
  return (
    <section className="fundamentals-question" aria-label={t('fundamentalsPracticeStep')}>
      <p className="eyebrow">{t('fundamentalsQuestionNumber', { current, total })}</p>
      <details className="fundamentals-reading-return">
        <summary>{t('fundamentalsReadRelatedLesson')}</summary>
        <FundamentalsLesson unit={unit} sectionId={question.sectionId} />
      </details>
      <QuestionCard question={question} last={last} onNext={onNext} onAnswer={onAnswer} />
    </section>
  );
}
