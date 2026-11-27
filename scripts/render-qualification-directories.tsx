import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Locale } from '../src/locales.ts';
import { LearningArticle, LearningDirectory } from '../src/qualificationLearning/LearningViews.tsx';
import {
  qualificationLearningPages,
  qualificationLearningRoute,
} from '../src/qualificationLearning/routes.ts';
import type { StudyUnit } from '../src/qualificationLearning/types.ts';

export async function renderQualificationDirectories(
  locale: Locale,
  insert: (locale: Locale, page: string, content: string) => Promise<void>,
) {
  for (const page of qualificationLearningPages) {
    const route = qualificationLearningRoute(locale, page);
    if (!route) throw new Error(`Missing qualification curriculum route: ${locale}/${page}`);
    const unit =
      route.unitId &&
      (JSON.parse(
        await readFile(
          `src/qualificationLearning/content/${route.courseId}/${locale}/${route.unitId}.json`,
          'utf8',
        ),
      ) as StudyUnit | undefined);
    await insert(
      locale,
      page,
      renderToStaticMarkup(
        unit ? (
          <LearningArticle route={route} unit={unit} locale={locale} />
        ) : (
          <LearningDirectory route={route} locale={locale} />
        ),
      ),
    );
  }
}
