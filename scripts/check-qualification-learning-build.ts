import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { studyCourses } from '../src/certifications.ts';
import { localePath, locales } from '../src/locales.ts';
import figures from '../src/qualificationLearning/figures.json' with { type: 'json' };
import {
  qualificationLearningPages,
  qualificationLearningRoute,
  qualificationPrerequisitePath,
} from '../src/qualificationLearning/routes.ts';
import type { StudyFigure, StudyUnit } from '../src/qualificationLearning/types.ts';
import { isAnswerComplete, isCorrectAnswer, parseQuestions } from '../src/questions.ts';

import { assetPrefix, checkQualificationFigure } from './check-qualification-figure.ts';

const origin = 'https://kaq.katana-projects.org';
const figureBank: Record<string, StudyFigure> = figures;
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
assert(qualificationLearningPages.length, 'No published qualification learning content');
const allExistingIds = new Set<string>();
for (const { course } of studyCourses) {
  if (!course) continue;
  for (const bank of new Set([
    course.mock,
    ...course.archives,
    ...course.practice.map(({ path }) => path),
  ])) {
    const data = await readFile(`public/${bank}`, 'utf8');
    assert(!data.includes(assetPrefix), `A teaching figure URL occurs in ${bank}`);
    for (const figure of Object.keys(figureBank)) assert(!data.includes(figure), `${bank}/${figure}`);
    for (const question of parseQuestions(JSON.parse(data))) {
      allExistingIds.add(question.id);
      for (const key of ['figure', 'figures', 'figureId', 'diagram', 'diagrams'])
        assert(!Object.hasOwn(question, key), `${bank}/${question.id}/${key}`);
    }
  }
}

for (const figure of Object.values(figureBank)) await checkQualificationFigure(figure);
const courseQuestionIds = new Set<string>();
const keyFor = (unit: StudyUnit) => ({
  id: unit.id,
  sections: unit.sections.map(({ id, figureId, sources }) => [
    id,
    figureId,
    sources.map(({ url }) => url),
  ]),
  checkpoints: unit.checkpoints.map(({ id, correct, choices }) => [
    id,
    correct,
    choices.map(({ id }) => id),
  ]),
  prerequisites: unit.prerequisites.map(({ courseId, slug }) => [courseId, slug]),
  glossaryTerms: unit.glossaryTerms,
});
const identities = new Map<string, ReturnType<typeof keyFor>>();
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

for (const locale of ['ja' as const, ...locales.filter((value) => value !== 'ja')]) {
  const glossary = new Set<string>(
    (await read(`dist/translations/${locale}/site.json`)).glossary.map(
      ({ term }: { term: string }) => term,
    ),
  );
  for (const page of qualificationLearningPages) {
    const route = qualificationLearningRoute(locale, page);
    assert(route, `${locale}/${page}`);
    const path = localePath(locale, page);
    const html = await readFile(join('dist', path, 'index.html'), 'utf8');
    assert(html.includes(`<link rel="canonical" href="${origin}${path}">`), path);
    assert(html.includes('<h1>') && sitemap.includes(`<loc>${origin}${path}</loc>`), path);
    for (const other of locales)
      assert(html.includes(`hreflang="${other}" href="${origin}${localePath(other, page)}"`), path);
    const unitIds = Object.keys(route.course.units);
    const nextUnitId = route.unitId ? unitIds[unitIds.indexOf(route.unitId) + 1] : undefined;
    const nextHref = nextUnitId
      ? localePath(locale, `${route.page}/${nextUnitId}`)
      : `${localePath(locale, `study/${route.courseId}`)}?mode=exam`;
    assert(html.includes(`href="${nextHref}"`), path);
    if (!route.unitId) continue;
    const assetPath = `src/qualificationLearning/content/${route.courseId}/${locale}/${route.unitId}.json`;
    const unit = (await read(assetPath)) as StudyUnit;
    assert.equal(unit.id, route.unitId, assetPath);
    const localizedText = JSON.stringify(unit);
    if (locale !== 'ko') assert(!/\p{Script=Hangul}/u.test(localizedText), assetPath);
    if (locale !== 'ja')
      assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(localizedText), assetPath);
    if (!['ja', 'ko', 'zh-CN', 'zh-TW'].includes(locale)) {
      assert(!/\p{Script=Han}/u.test(localizedText), assetPath);
    }
    assert.deepEqual(
      route.course.units[unit.id],
      { title: unit.title, objective: unit.objective },
      assetPath,
    );
    assert(unit.sections.length >= 3 && unit.checkpoints.length >= 3, assetPath);
    if (locale === 'ja') {
      identities.set(page, keyFor(unit));
      for (const question of unit.checkpoints) {
        assert(!allExistingIds.has(question.id) && !courseQuestionIds.has(question.id), question.id);
        courseQuestionIds.add(question.id);
      }
    } else assert.deepEqual(keyFor(unit), identities.get(page), assetPath);
    for (const item of unit.prerequisites)
      await access(join('dist', qualificationPrerequisitePath(locale, item), 'index.html'));
    for (const term of unit.glossaryTerms) assert(glossary.has(term), `${assetPath}/${term}`);
    for (const section of unit.sections) {
      assert(section.paragraphs.length && section.sources.length, `${assetPath}/${section.id}`);
      if (!section.figureId) continue;
      const figure = figureBank[section.figureId];
      assert(
        figure &&
          html.includes(`data-figure="${section.figureId}"`) &&
          html.includes(`src="${figure.src}"`),
        assetPath,
      );
    }
    for (const question of unit.checkpoints) {
      assert(
        isAnswerComplete(question, question.correct) && isCorrectAnswer(question, question.correct),
        question.id,
      );
      assert(
        question.choices.every(({ text, explanation }) => text.trim() && explanation.trim()),
        question.id,
      );
      assert(!html.includes(`value="${question.correct[0]}"`), question.id);
    }
  }
}

console.log(
  `Validated ${qualificationLearningPages.length} qualification learning routes in ten locales and figure isolation from all 14 mock banks`,
);
