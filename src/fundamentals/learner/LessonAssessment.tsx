import { usePreferences } from '../../preferences';
import { QuestionClarifications } from '../../QuestionClarifications';
import type { FundamentalsQuestion } from '../types';
import './learner-assessment.css';

type Feedback = { correct: string[]; submitted: true };
type CommonProps = {
  question: FundamentalsQuestion;
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  busy?: boolean;
  error?: string;
};

export type LessonCheckpointProps = CommonProps & {
  mode: 'checkpoint';
  feedback?: Feedback;
  onSubmit: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
};
export type LessonFinalProps = CommonProps & {
  mode: 'final';
  feedback?: never;
  onSubmit?: never;
};
export type LessonAssessmentProps = LessonCheckpointProps | LessonFinalProps;

export function LessonAssessment(props: LessonAssessmentProps) {
  const { t } = usePreferences();
  const { question, selected, onChange, busy = false, error } = props;
  const multiple = question.requiredChoices > 1;
  const submitted = props.mode === 'checkpoint' && Boolean(props.feedback?.submitted);
  const correct = props.mode === 'checkpoint' && props.feedback ? props.feedback.correct : [];
  const matches =
    submitted && correct.length === selected.length && correct.every((id) => selected.includes(id));
  const submit = props.mode === 'checkpoint' ? props.onSubmit : undefined;
  const retry = props.mode === 'checkpoint' ? props.onRetry : undefined;
  function choose(id: string, checked: boolean) {
    if (submitted || busy) return;
    const next = multiple
      ? checked
        ? [...selected, id]
        : selected.filter((value) => value !== id)
      : checked
        ? [id]
        : [];
    onChange(next);
  }
  return (
    <article className="lesson-assessment" aria-label={t('lessonAssessment')}>
      <p className="lesson-assessment-prompt">{question.prompt}</p>
      <QuestionClarifications question={question} />
      <p className="lesson-assessment-hint">
        {t('lessonChoiceHint', { count: question.requiredChoices })}
      </p>
      <fieldset disabled={busy || submitted}>
        <legend className="sr-only">{question.prompt}</legend>
        {question.choices.map((choice) => {
          const checked = selected.includes(choice.id);
          const inputId = `${question.id}-${choice.id}`;
          return (
            <label className="lesson-choice" htmlFor={inputId} key={choice.id}>
              <input
                id={inputId}
                type={multiple ? 'checkbox' : 'radio'}
                name={question.id}
                value={choice.id}
                checked={checked}
                disabled={!checked && multiple && selected.length >= question.requiredChoices}
                onChange={(event) => choose(choice.id, event.currentTarget.checked)}
              />
              <span>
                {choice.text}
                {submitted ? (
                  <small>
                    {correct.includes(choice.id) ? t('lessonCorrectChoice') : ''}
                    {selected.includes(choice.id) ? ` ${t('lessonSelectedChoice')}` : ''}{' '}
                    {choice.explanation}
                  </small>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      {error ? (
        <p role="alert" className="lesson-assessment-error">
          {error}
        </p>
      ) : null}
      {submitted && props.mode === 'checkpoint' ? (
        <>
          <p role="status">{matches ? t('lessonCheckpointCorrect') : t('lessonCheckpointIncorrect')}</p>
          {retry ? (
            <button type="button" onClick={() => void retry()} disabled={busy}>
              {t('lessonCheckpointRetry')}
            </button>
          ) : null}
        </>
      ) : null}
      {props.mode === 'checkpoint' ? (
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (submit) void submit();
          }}
          disabled={busy || submitted || selected.length !== question.requiredChoices}
        >
          {t('lessonCheckpointSubmit')}
        </button>
      ) : null}
    </article>
  );
}
