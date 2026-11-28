import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { imageCatalog, imageForSlot, imagePlacementsFor, imageSlot } from '../src/images/catalog.ts';
import type { StudyUnit } from '../src/qualificationLearning/types.ts';

const allPaths = new Set<string>();
const labelsBySource = new Map<string, Set<string>>();
const japaneseText = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const usedLayouts = new Set<string>();
const usedAssets = new Set<string>();
for (const [id, placement] of Object.entries(imageCatalog.placements)) {
  const layout = imageCatalog.layouts[placement.layout];
  assert(layout, id);
  usedLayouts.add(placement.layout);
  assert(Boolean(placement.asset) !== Boolean(placement.remote), id);
  if (placement.remote) {
    assert.equal(layout.referrerPolicy, 'no-referrer', id);
    continue;
  }
  assert(placement.asset && imageCatalog.assets[placement.asset], id);
  usedAssets.add(placement.asset);
}
for (const [source, translation] of Object.entries(imageCatalog.japanese)) {
  assert.equal(imageCatalog.assets[source]?.language, 'en', source);
  assert.equal(imageCatalog.assets[translation]?.language, 'ja', translation);
  usedAssets.add(translation);
}
assert.deepEqual([...usedLayouts].sort(), Object.keys(imageCatalog.layouts).sort());
assert.deepEqual([...usedAssets].sort(), Object.keys(imageCatalog.assets).sort());

for (const [id, asset] of Object.entries(imageCatalog.assets)) {
  assert(/^\/[\w/.-]+\.(png|svg)$/u.test(asset.src) && !asset.src.split('/').includes('..'), id);
  assert(!allPaths.has(asset.src), id);
  allPaths.add(asset.src);
  const bytes = await readFile(`dist${asset.src}`);
  if (asset.equivalentTo) {
    const original = imageCatalog.assets[asset.equivalentTo];
    assert(original, id);
    assert.deepEqual(bytes, await readFile(`dist${original.src}`), id);
  }
  if (asset.src.endsWith('.png')) {
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', id);
    continue;
  }
  const svg = bytes.toString('utf8');
  assert(/<svg\b/u.test(svg), id);
  assert(!/<(?:script|image|foreignObject)\b/u.test(svg), id);
  assert(!/(?:href|src)=["\x27](?!#)/u.test(svg), id);
  if (!asset.language) continue;
  assert(asset.alt.trim() && asset.width && asset.height, id);
  const labels = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gu)].map((match) => match[1]);
  assert(new Set(labels).size > 1 && !svg.includes('light-dark('), id);
  labelsBySource.set(asset.src, new Set(labels.map((label) => label.replace(/<[^>]+>/gu, '').trim())));
  assert.equal(
    labels.some((label) => japaneseText.test(label)),
    asset.language === 'ja',
    id,
  );
  assert.equal(japaneseText.test(asset.alt), asset.language === 'ja', id);
  const viewBox = svg
    .match(/\bviewBox="([^"]+)"/u)?.[1]
    .trim()
    .split(/[\s,]+/u)
    .map(Number);
  assert(viewBox?.length === 4 && viewBox.every(Number.isFinite), id);
  assert(Math.abs(viewBox[2] - asset.width) < 1 && Math.abs(viewBox[3] - asset.height) < 1, id);
  if (asset.authoring) {
    const drawing = await readFile(asset.authoring, 'utf8');
    assert(drawing.includes('<mxGraphModel') && /<mxCell\b[^>]*\bvalue="[^"]+"/u.test(drawing), id);
  } else assert(asset.language === 'en' && id.startsWith('applied/'), id);
}

const sources = await readdir('src', { recursive: true });
for (const relative of sources) {
  const match = relative.match(/^qualificationLearning\/content\/([^/]+)\/ja\/[^/]+\.json$/u);
  if (match) {
    const unit = JSON.parse(await readFile(join('src', relative), 'utf8')) as StudyUnit;
    for (const section of unit.sections) {
      const slot = imageSlot('qualification', match[1], unit.id, section.id);
      const asset = imageForSlot(slot, 'ja');
      if (!asset) continue;
      for (const guide of section.paragraphs.filter((paragraph) => paragraph.startsWith('図'))) {
        for (const [, label] of guide.matchAll(/「([^」]+)」/gu)) {
          assert(
            labelsBySource.get(asset.src)?.has(label),
            `${relative}/${section.id}: missing diagram label ${label}`,
          );
        }
      }
    }
    if (!imagePlacementsFor(imageSlot('qualification', match[1], unit.id)).length) {
      for (const question of unit.checkpoints) {
        assert(
          !/図(?:の(?:各|上|下|左|右|中)|を(?:参照|見)|に示)/u.test(JSON.stringify(question)),
          `${relative}/${question.id}: missing referenced diagram`,
        );
      }
    }
  }
  if (!/\.(tsx?|css)$/u.test(relative) || relative.startsWith('images/')) continue;
  const source = await readFile(join('src', relative), 'utf8');
  assert(!/<img\b|\bnew\s+Image\s*\(/u.test(source), relative);
  if (relative.endsWith('.css'))
    assert(!/url\([^)]*\.(?:png|svg|webp|jpe?g|gif)\b/u.test(source), relative);
}
const englishIds = Object.entries(imageCatalog.assets)
  .filter(([, asset]) => asset.language === 'en')
  .map(([id]) => id)
  .sort();
assert.deepEqual(
  Object.keys(imageCatalog.japanese).sort(),
  englishIds,
  'Missing Japanese teaching images',
);

const favicon = await readFile('dist/index.html', 'utf8');
const icon = imageCatalog.placements['site/document/favicon']?.asset;
assert(icon && favicon.includes(`href="${imageCatalog.assets[icon].src}"`));
console.log(
  `Validated ${allPaths.size} image paths and ${Object.keys(imageCatalog.placements).length} central placements`,
);
