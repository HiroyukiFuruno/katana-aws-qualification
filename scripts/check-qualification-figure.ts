import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StudyFigure } from '../src/qualificationLearning/types.ts';

export const assetPrefix = '/qualification-learning/figures/';

export async function checkQualificationFigure(figure: StudyFigure) {
  assert(figure.src.startsWith(assetPrefix) && figure.src.endsWith('.svg'), figure.src);
  assert(
    /[A-Za-z]/u.test(figure.alt) &&
      !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(figure.alt),
    figure.src,
  );
  const svg = await readFile(join('dist', figure.src), 'utf8');
  const root = svg.match(/<svg\b[^>]*>/u)?.[0];
  const viewBox = root
    ?.match(/\bviewBox="([^"]+)"/u)?.[1]
    .trim()
    .split(/[\s,]+/u)
    .map(Number);
  assert(viewBox?.length === 4 && viewBox.every(Number.isFinite), figure.src);
  assert.deepEqual([figure.width, figure.height], viewBox.slice(2).map(Math.ceil), figure.src);
  const distinctLabels = new Set(
    [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gu)]
      .map(([, markup]) => markup.replace(/<[^>]+>/gu, '').trim())
      .filter(Boolean),
  );
  assert(distinctLabels.size > 1, `${figure.src}: the exported figure needs content beyond its title`);
  assert(!/<(?:foreignObject|image)\b/u.test(svg), `${figure.src}: use native SVG labels and shapes`);
  assert(!svg.includes('light-dark('), `${figure.src}: keep figure colors consistent across themes`);
  const svgPath = figure.src.slice(assetPrefix.length);
  if (svgPath === 'clf-c02/clf-shared-responsibility-boundary.svg') {
    const shared = await readFile('dist/fundamentals/figures/cloud-shared-responsibility.svg', 'utf8');
    assert.equal(svg, shared, `${figure.src}: the shared foundation figure differs`);
    await access('src/fundamentals/figures-source/cloud-shared-responsibility.drawio');
  } else {
    const authoring = await readFile(
      join('src/qualificationLearning/figures-source', svgPath.replace(/\.svg$/u, '.drawio')),
      'utf8',
    );
    const authoredLabels = new Set(
      [...authoring.matchAll(/<mxCell\b[^>]*\bvalue="([^"]+)"/gu)].map(([, label]) => label.trim()),
    );
    authoredLabels.delete('');
    assert(authoredLabels.size > 1, `${figure.src}: the Draw.io file needs content beyond its title`);
  }
}
