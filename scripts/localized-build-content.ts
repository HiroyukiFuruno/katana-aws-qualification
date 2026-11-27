import { readFile } from 'node:fs/promises';
import type { SiteContent } from '../src/contentTypes';
import type { DeliveryIndexAsset, DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonDisplayText, lessonReadingCopy } from '../src/fundamentals/delivery/lessonReadingCopy.ts';
import networkFigures from '../src/fundamentals/delivery/network-figures.json' with { type: 'json' };
import { isPrivateLessonPage, lessonPageAt } from '../src/fundamentals/delivery/routePages.ts';
import type { Locale } from '../src/locales';
import { localePath } from '../src/locales.ts';

type StaticLessonContent = {
  title: string;
  description: string;
  body: {
    heading: string;
    paragraphs: string[];
    figure?: { url: string; alt: string; width: number; height: number };
  };
};

const figures = new Map(Object.entries(networkFigures));

function compact(value: string) {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function metaDescription(value: string) {
  return compact(value).slice(0, 160);
}

export async function localizedBuildContent(locale: Locale) {
  const site: SiteContent = JSON.parse(
    await readFile(`public/translations/${locale}/site.json`, 'utf8'),
  );
  const path =
    locale === 'ja'
      ? 'public/fundamentals/delivery/index.json'
      : `public/translations/${locale}/fundamentals/delivery/index.json`;
  const lessons: DeliveryIndexAsset = JSON.parse(await readFile(path, 'utf8'));
  const assetPath = (slug: string) =>
    locale === 'ja'
      ? `public/fundamentals/delivery/${slug}.json`
      : `public/translations/${locale}/fundamentals/delivery/${slug}.json`;
  const assets = new Map<string, Promise<DeliveryUnitAsset>>();
  const assetFor = (slug: string) => {
    const pending = assets.get(slug);
    if (pending) return pending;
    const asset = readFile(assetPath(slug), 'utf8').then(
      (value) => JSON.parse(value) as DeliveryUnitAsset,
    );
    assets.set(slug, asset);
    return asset;
  };

  async function lessonFor(page: string): Promise<StaticLessonContent | undefined> {
    if (isPrivateLessonPage(page)) return undefined;
    const lesson = lessonPageAt(localePath(locale, page));
    if (!lesson) return undefined;
    const unit = lessons.units.find((item) => item.unitId === lesson.route.unitId);
    if (!unit) throw new Error(`Missing localized lesson index: ${locale}/${page}`);
    if (lesson.route.stage === 'final' || lesson.route.stage === 'result') return undefined;
    const objective = lessonDisplayText(unit.objective, locale, unit.unitId);
    if (lesson.route.stage === 'resume') {
      return {
        title: unit.title,
        description: metaDescription(objective),
        body: { heading: unit.title, paragraphs: [objective] },
      };
    }
    const position = lesson.route.position;
    if (typeof position !== 'number')
      throw new Error(`Missing public lesson position: ${locale}/${page}`);
    const asset = await assetFor(unit.slug);
    const original = asset.steps[position - 1];
    const step = original && lessonReadingCopy(original, locale);
    const routeMatchesStep =
      step &&
      step.kind !== 'final' &&
      (lesson.route.stage === 'checkpoints' ? step.kind === 'checkpoint' : step.kind !== 'checkpoint');
    if (!routeMatchesStep) throw new Error(`Invalid public lesson route: ${locale}/${page}`);
    const checkpoint =
      step.kind === 'checkpoint'
        ? asset.checkpoints.find((question) => question.id === step.assessmentId)
        : undefined;
    if (step.kind === 'checkpoint' && !checkpoint)
      throw new Error(`Missing localized checkpoint: ${locale}/${page}`);
    const paragraphs = checkpoint
      ? [compact(lessonDisplayText(checkpoint.prompt, locale, step.unitId))]
      : step.blocks.map((block) => compact(block.text)).filter(Boolean);
    const summary = paragraphs.join(' ');
    return {
      title: `${unit.title}: ${checkpoint?.title ?? step.label} (${step.position})`,
      description: metaDescription(summary || `${unit.title}: ${checkpoint?.title ?? step.label}`),
      body: {
        heading: checkpoint?.title ?? step.label,
        paragraphs: paragraphs.length ? paragraphs : [objective],
        figure: step.kind === 'reading' ? figures.get(step.id) : undefined,
      },
    };
  }

  return {
    async lessonFor(page: string) {
      return lessonFor(page);
    },
    async titleFor(page: string) {
      const lesson = await lessonFor(page);
      if (lesson) {
        return lesson.title;
      }
      const lessonPage = lessonPageAt(localePath(locale, page));
      if (lessonPage) {
        const unit = lessons.units.find((item) => item.unitId === lessonPage.route.unitId);
        if (!unit) throw new Error(`Missing localized lesson title: ${locale}/${page}`);
        return unit.title;
      }
      const id = page.split('/')[1];
      const certification = site.certifications[id];
      return certification ? `${certification.name} (${id.toUpperCase()})` : undefined;
    },
    descriptionFor(page: string) {
      const id = page.split('/')[1];
      return page.startsWith('certifications/') ? site.guides[id]?.scope : undefined;
    },
  };
}
