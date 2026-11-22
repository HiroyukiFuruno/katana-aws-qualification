import { expect, test } from 'bun:test';
import { aiBusinessStrategistCourse } from '../src/aiBusinessStrategistCourse';
import { parseQuestions } from '../src/questions';
import { translationKey } from '../src/questionTranslations';
import { legacyNaturalExports } from './legacy-natural-exports';

test('legacy natural exports preserve all current and archived revisions of the same question ID', async () => {
  const paths = [aiBusinessStrategistCourse.mock, ...(aiBusinessStrategistCourse.archives ?? [])].filter(
    (path): path is string => Boolean(path),
  );
  const banks = await Promise.all(
    paths.map(async (path) => parseQuestions(await Bun.file(`public/${path}`).json())),
  );
  const source = banks.flat();
  expect(source).toHaveLength(441);
  expect(new Set(source.map(({ id }) => id)).size).toBeLessThan(source.length);
  const keys = source.map(translationKey).sort();
  expect(new Set(keys).size).toBe(source.length);

  const outputs = await legacyNaturalExports();
  expect(outputs).toHaveLength(9);
  for (const { locale, payload, manifest } of outputs) {
    expect(Object.keys(payload.questions).sort()).toEqual(keys);
    expect(Object.keys(manifest.banks).sort()).toEqual([...paths].sort());
    for (const [index, path] of paths.entries()) {
      const localized = parseQuestions(await Bun.file(`public/translations/${locale}/${path}`).json());
      for (const [questionIndex, question] of banks[index].entries()) {
        const exported = payload.questions[translationKey(question)];
        expect(exported.prompt).toBe(localized[questionIndex].prompt);
        expect(exported.learning).toEqual(localized[questionIndex].learning);
      }
    }
  }
});
