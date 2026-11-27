import { expect, test } from 'bun:test';
import type { DeliveryIndexAsset, DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonReadingCopy } from '../src/fundamentals/delivery/lessonReadingCopy';
import labels from '../src/fundamentals/delivery/misconception-labels.json';
import type { FundamentalsContent } from '../src/fundamentals/types';
import { type Locale, locales } from '../src/locales';
import type { CheckpointDocument } from './fundamentals-delivery/source';

function deliveryUnit(locale: Locale, slug: string): Promise<DeliveryUnitAsset> {
  const root = locale === 'ja' ? 'public' : `public/translations/${locale}`;
  return Bun.file(`${root}/fundamentals/delivery/${slug}.json`).json();
}

const index: DeliveryIndexAsset = await Bun.file('public/fundamentals/delivery/index.json').json();
const units = index.units.filter((unit) => unit.state === 'published');

test('the Japanese lesson and assessment screens avoid the reported unnatural wording', async () => {
  for (const { slug } of units) {
    const lesson = await deliveryUnit('ja', slug);
    const questions = [...lesson.checkpoints, ...lesson.finalQuestions];
    const texts = [
      ...lesson.steps
        .map((step) => lessonReadingCopy(step, 'ja'))
        .flatMap((step) => [step.label, ...step.blocks.map((block) => block.text)]),
      ...questions.flatMap(({ prompt, title, choices }) => [
        title,
        prompt,
        ...choices.flatMap(({ text, explanation }) => [text, explanation]),
      ]),
    ];
    const copy = texts.join('\n');
    expect(copy, slug).not.toMatch(/新版本|観測窓|データ点|これは誤りと訂正|private接続/);
  }
});

test('all locales display the authored paragraph order and use the localized misconception labels', async () => {
  for (const locale of locales) {
    for (const { slug } of units) {
      const asset = await deliveryUnit(locale, slug);
      for (const step of asset.steps) {
        const display = lessonReadingCopy(step, locale);
        const body = step.blocks.map((block) => block.text);
        expect(
          display.blocks.map((block) => block.text),
          `${locale}/${step.id}`,
        ).toEqual(body);
        if (step.kind === 'misconception') {
          expect(display.label).toBe(labels[locale].heading);
          expect(display.blocks.map((block) => block.label)).toEqual([
            labels[locale].misconception,
            labels[locale].correction,
          ]);
        }
        for (const heading of [step.label, ...step.blocks.map((block) => block.label)]) {
          expect(body, `${locale}/${step.id}`).not.toContain(heading);
        }
        expect(new Set(body).size, `${locale}/${step.id}`).toBe(body.length);
      }
    }
  }
});

test('all locales present the same full question in the source data and learner assessment', async () => {
  for (const locale of locales) {
    const root = locale === 'ja' ? 'public' : `public/translations/${locale}`;
    const content: FundamentalsContent = await Bun.file(`${root}/fundamentals/content.json`).json();
    const checkpoints: CheckpointDocument = await Bun.file(
      `${root}/fundamentals/checkpoints.json`,
    ).json();
    for (const { slug, unitId } of units) {
      const authorship = content.units.find(({ id }) => id === unitId);
      const checkpointAuthor = checkpoints.units.find((item) => item.unitId === unitId);
      const lesson = await deliveryUnit(locale, slug);
      expect(authorship?.questions).toHaveLength(lesson.finalQuestions.length);
      expect(checkpointAuthor?.checkpoints).toHaveLength(lesson.checkpoints.length);
      for (const [source, delivered] of [
        [authorship?.questions, lesson.finalQuestions],
        [checkpointAuthor?.checkpoints, lesson.checkpoints],
      ] as const) {
        for (const question of delivered) {
          const original = source?.find(({ id }) => id === question.id);
          expect(original, `${locale}/${question.id}`).toMatchObject({
            title: question.title,
            prompt: question.prompt,
            choices: question.choices,
            correct: question.correct,
            selectionPolarity: question.selectionPolarity,
            requiredChoices: question.requiredChoices,
          });
        }
      }
    }
  }
});

test('every locale keeps the context needed to answer the reported ambiguous questions', async () => {
  for (const locale of locales) {
    const signals = await deliveryUnit(locale, 'observability');
    const question = (id: string) => {
      const value = signals.finalQuestions.find((entry) => entry.id === id);
      if (!value) throw new Error(`Missing question: ${locale}/${id}`);
      return value;
    };
    expect(question('fund-observe-107').prompt, locale).toMatch(/500/);
    expect(question('fund-observe-107').prompt, locale).toMatch(/SLI/);
    expect(question('fund-observe-108').prompt, locale).toMatch(/API/);
    expect(question('fund-observe-111').prompt, locale).toMatch(/RDS Proxy/);
    const routing = await deliveryUnit(locale, 'routing-connectivity');
    const route = routing.finalQuestions.find(({ id }) => id === 'fund-route-001');
    expect(route?.prompt, locale).toMatch(/VPC/);
    expect(route?.choices.find(({ id }) => id === 'A')?.text, locale).toMatch(/CIDR/);
  }
});
