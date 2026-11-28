import { useEffect, useState } from 'react';
import { type Locale, localePath } from '../locales';
import { messages } from '../messages';
import studyCopy from './copy.json' with { type: 'json' };
import { LearningArticle, LearningDirectory, type LearningRoute } from './LearningViews';
import type { StudyUnit } from './types';

const units = import.meta.glob<StudyUnit>('./content/*/*/*.json', { import: 'default' });
type View = { mode: 'loading' | 'failed' } | { mode: 'ready'; unit: StudyUnit };

function UnitScreen({ route, locale }: { route: LearningRoute; locale: Locale }) {
  const [view, setView] = useState<View>({ mode: 'loading' });
  const copy = messages[locale];
  const path = `./content/${route.courseId}/${locale}/${route.unitId}.json`;

  useEffect(() => {
    let active = true;
    const load = units[path];
    if (!load) throw new Error(`Published qualification unit is missing: ${path}`);
    void load().then(
      (unit) => {
        if (active) setView({ mode: 'ready', unit });
      },
      () => {
        if (active) setView({ mode: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [path]);

  if (view.mode === 'ready')
    return <LearningArticle route={route} unit={view.unit} locale={locale} interactive />;
  return (
    <main className="shell qualification-lesson" id="main">
      <h1>{route.title}</h1>
      {view.mode === 'loading' ? (
        <p role="status">{copy.fundamentalsLoading}</p>
      ) : (
        <div className="notice">
          <p role="alert">{copy.loadContentError}</p>
          <div className="qualification-error-actions">
            <button type="button" onClick={() => location.reload()}>
              {copy.fundamentalsReload}
            </button>
            <a href={localePath(locale, route.page)}>{studyCopy[locale].back}</a>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LearningScreen({ route, locale }: { route: LearningRoute; locale: Locale }) {
  if (!route.unitId) return <LearningDirectory route={route} locale={locale} />;
  return (
    <UnitScreen key={`${locale}/${route.courseId}/${route.unitId}`} route={route} locale={locale} />
  );
}
