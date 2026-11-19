import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

for (const locale of locales) {
  const path = localePath(locale);
  const html = await readFile(join('dist', path, 'index.html'), 'utf8');
  const { landingTitle, landingTitleEmphasis, landingIntro, landingDescription } = messages[locale];
  assert(landingTitle.includes(landingTitleEmphasis), `${locale}: highlight a word in the title`);
  assert(landingIntro.includes('KAQ'), `${locale}: introduce the KAQ brand`);
  assert.notEqual(landingDescription, landingIntro, `${locale}: explain uses separately from the hero`);
  assert(
    html.includes(`<title>${escapeHtml(landingTitle)} | KatanA AWS Qualification</title>`),
    `${locale}: keep the learning concept and brand in the title`,
  );
  assert(
    html.includes(`<meta name="description" content="${escapeHtml(landingDescription)}">`),
    `${locale}: publish the concept and uses in the search description`,
  );
}

assert.equal(messages.ja.landingTitle, '気楽に学ぶ、AWS。');
assert(!messages.ja.landingIntro.includes('試験対策'));
assert(messages.ja.landingConceptUses.includes('AWS認定資格の試験対策'));
assert(messages.ja.landingDescription.includes('AWS認定資格の試験対策'));
console.log(`Validated the learning concept and search metadata for ${locales.length} landing pages`);
