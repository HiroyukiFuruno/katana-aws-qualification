import type { ExamBlueprint } from './certifications';
import { ExamFormatPicker } from './ExamFormatPicker';
import type { Message } from './messages';
import type { usePreferences } from './preferences';

type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamSetup({
  blueprint,
  available,
  saving,
  onStart,
  error,
  t,
}: {
  blueprint: ExamBlueprint;
  available: boolean;
  saving: boolean;
  onStart: (count: number) => void;
  error: Message | '';
  t: Translate;
}) {
  return (
    <section className="card">
      <h2>{t('examSetup')}</h2>
      <p>{t('examTiming')}</p>
      <p>{t('examTimerWarning')}</p>
      {!available && <p role="alert">{t('tooFew')}</p>}
      <ExamFormatPicker
        blueprint={blueprint}
        available={available}
        saving={saving}
        onStart={onStart}
        buttonLabel={t('startExam')}
      />
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
