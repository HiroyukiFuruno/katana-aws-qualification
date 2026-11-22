import type { ExamDraft, ExamResponse } from './exam';
import { StructuredAnswerFields } from './StructuredAnswer';
import type { Question } from './questions';
import { usePreferences } from './preferences';
import { choiceLabel } from './choiceLabels';
import { QuestionClarifications } from './QuestionClarifications';

type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamQuestion({
  draft,
  question,
  choiceOrder,
  response,
  expired,
  submitting,
  t,
  heading,
  onUpdate,
}: {
  draft: ExamDraft;
  question: Question;
  choiceOrder: string[];
  response: ExamResponse;
  expired: boolean;
  submitting: boolean;
  t: Translate;
  heading: React.RefObject<HTMLHeadingElement | null>;
  onUpdate: (position: number, patch?: Partial<ExamResponse>) => void;
}) {
  const { locale } = usePreferences();
  const count = question.correct.length;
  const choices = choiceOrder
    .map((id) => question.choices.find((choice) => choice.id === id))
    .filter((choice): choice is Question['choices'][number] => choice !== undefined);
  return (
    <section className="card" aria-busy={submitting}>
      <div className="question-meta">
        <span>
          {question.format === 'ordering'
            ? t('orderSteps')
            : question.format === 'matching'
              ? t('matchPairs')
              : t('choose', { count })}
        </span>
      </div>
      <h2 ref={heading} tabIndex={-1} className="exam-question-title">
        {t('questionNumber', { number: draft.position + 1 })}
      </h2>
      <p className="prompt" lang={question.locale ?? locale}>
        {question.prompt}
      </p>
      <QuestionClarifications question={question} />
      <fieldset disabled={expired || submitting}>
        <legend className="sr-only">{t('choices')}</legend>
        {question.format ? (
          <StructuredAnswerFields
            question={question}
            selected={response.selected}
            choiceOrder={choiceOrder}
            onChange={(selected) =>
              onUpdate(draft.position, {
                selected,
                selectedAt: selected.length ? Date.now() : undefined,
              })
            }
          />
        ) : (
          choices.map((choice) => {
            const selected = response.selected.includes(choice.id);
            return (
              <label key={choice.id} className={`choice choice-wrap ${selected ? 'picked' : ''}`}>
                <input
                  type={count === 1 ? 'radio' : 'checkbox'}
                  name="exam-answer"
                  checked={selected}
                  disabled={!selected && count > 1 && response.selected.length === count}
                  onChange={() =>
                    onUpdate(draft.position, {
                      selected:
                        count === 1
                          ? [choice.id]
                          : selected
                            ? response.selected.filter((id) => id !== choice.id)
                            : [...response.selected, choice.id],
                      selectedAt: Date.now(),
                    })
                  }
                />
                <span className="letter">{choiceLabel(choices, choice.id)}</span>
                <span lang={question.locale ?? locale}>{choice.text}</span>
              </label>
            );
          })
        )}
      </fieldset>
      <div className="exam-actions">
        <button
          type="button"
          disabled={expired || submitting || !response.selected.length}
          onClick={() => onUpdate(draft.position, { selected: [], selectedAt: undefined })}
        >
          {t('clearChoice')}
        </button>
        <button
          type="button"
          aria-pressed={response.flagged}
          disabled={expired || submitting}
          onClick={() => onUpdate(draft.position, { flagged: !response.flagged })}
        >
          {t('flag')}
        </button>
      </div>
      <div className="exam-actions exam-nav">
        <button
          type="button"
          disabled={expired || submitting || draft.position === 0}
          onClick={() => onUpdate(draft.position - 1)}
        >
          {t('previous')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={expired || submitting || draft.position + 1 === draft.order.length}
          onClick={() => onUpdate(draft.position + 1)}
        >
          {t('nextExamQuestion')}
        </button>
      </div>
    </section>
  );
}
