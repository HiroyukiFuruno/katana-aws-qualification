import { usePreferences } from './preferences';

export function AssessmentContentError() {
  const { t } = usePreferences();
  return <p role="alert">{t('invalidQuestionData')}</p>;
}
