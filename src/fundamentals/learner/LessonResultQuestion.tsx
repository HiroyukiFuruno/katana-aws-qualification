import type { Locale } from '../../locales';
import { usePreferences } from '../../preferences';
import { QuestionClarifications } from '../../QuestionClarifications';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonDisplayText } from '../delivery/lessonReadingCopy';
import type { LessonFinalSession } from '../state/types';
import { reviewPath, selectedSetMatches } from './lesson-result-helpers';

export function LessonResultQuestion({
  asset,
  question,
  session,
  index,
  position,
  locale,
  contentVersion,
  onNavigate,
}: {
  asset: DeliveryUnitAsset;
  question: DeliveryQuestion;
  session: LessonFinalSession;
  index: number;
  position: number;
  locale: Locale;
  contentVersion?: string;
  onNavigate: (href: string) => void;
}) {
  const { t } = usePreferences();
  const display = (text: string) => lessonDisplayText(text, locale, question.unitId);
  const selected = session.responses[String(index)]?.selected ?? [];
  const answered = selected.length > 0;
  const exact = selectedSetMatches(question, selected);
  const reviewHref = reviewPath(asset, question.sectionId ?? '', locale, contentVersion);
  return (
    <details className="card lesson-result-question">
      <summary>
        {t('questionNumber', { number: position })}: {display(question.title)}
      </summary>
      <p>{display(question.prompt)}</p>
      <QuestionClarifications question={question} />
      <p className={exact ? 'lesson-result-correct' : 'lesson-result-incorrect'}>
        {answered ? (exact ? t('correct') : t('incorrect')) : t('unanswered')}
      </p>
      <ul>
        {question.choices.map((choice) => {
          const chosen = selected.includes(choice.id);
          const answer = question.correct.includes(choice.id);
          return (
            <li key={choice.id} className="lesson-result-choice">
              <p>
                <strong>{display(choice.text)}</strong> {chosen && <span>({t('selected')})</span>}{' '}
                {answer && <span>({t('correct')})</span>}
              </p>
              <p>{display(choice.explanation)}</p>
            </li>
          );
        })}
      </ul>
      {reviewHref && (
        <a
          href={reviewHref}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              return;
            event.preventDefault();
            onNavigate(reviewHref);
          }}
        >
          {t('fundamentalsResultReviewSource')}
        </a>
      )}
    </details>
  );
}
