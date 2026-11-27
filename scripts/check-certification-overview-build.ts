import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Locale, localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';

const origin = 'https://kaq.katana-projects.org';
const overviewPage = 'certifications/overview';
const certificationIds = ['clf-c02', 'aif-c01', 'saa-c03'];
const alternateLanguages = [...locales, 'x-default'] as const;
const bodyMessageKeys = [
  'certOverviewTitle',
  'certOverviewDescription',
  'certOverviewMeaningTitle',
  'certOverviewMeaning',
  'certOverviewChooseTitle',
  'certOverviewGoalHeader',
  'certOverviewCertificationHeader',
  'certOverviewCloudGoal',
  'certOverviewAiGoal',
  'certOverviewDesignGoal',
  'certOverviewOtherGoals',
  'certOverviewStartTitle',
  'certOverviewStartBody',
  'certOverviewOfficialLink',
] as const;

type LocalizedContent = { certifications: Record<string, { name: string }> };

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeBodyText(value: string) {
  return escapeAttribute(value).replaceAll("'", '&#x27;');
}

function routeFile(locale: Locale, page: string) {
  return join('dist', localePath(locale, page), 'index.html');
}

function expectedAlternates() {
  return alternateLanguages.map((language) => ({
    language,
    path: localePath(language === 'x-default' ? 'en' : language, overviewPage),
  }));
}

for (const locale of locales) {
  const html = await readFile(routeFile(locale, overviewPage), 'utf8');
  const content = JSON.parse(
    await readFile(`public/translations/${locale}/site.json`, 'utf8'),
  ) as LocalizedContent;
  const dictionary = messages[locale];
  const path = localePath(locale, overviewPage);

  assert(html.includes(`<html lang="${locale}">`), `${locale}: document language`);
  assert(
    html.includes(
      `<title>${escapeAttribute(dictionary.certOverviewSearchTitle)} | ${escapeAttribute(dictionary.siteName)}</title>`,
    ),
  );
  assert(
    html.includes(
      `<meta name="description" content="${escapeAttribute(dictionary.certOverviewDescription)}">`,
    ),
  );
  assert(html.includes(`<link rel="canonical" href="${origin}${path}">`));
  assert.equal((html.match(/rel="alternate"/g) ?? []).length, 11, `${locale}: alternate count`);
  for (const { language, path: alternate } of expectedAlternates()) {
    assert(
      html.includes(`<link rel="alternate" hreflang="${language}" href="${origin}${alternate}">`),
      `${locale}: alternate ${language}`,
    );
  }
  assert(html.includes(`<h1>${escapeBodyText(dictionary.certOverviewTitle)}</h1>`));
  for (const key of bodyMessageKeys)
    assert(html.includes(escapeBodyText(dictionary[key])), `${locale}: overview copy ${key}`);
  for (const id of certificationIds) {
    assert(
      html.includes(escapeBodyText(content.certifications[id].name)),
      `${locale}: certification name ${id}`,
    );
    assert(html.includes(`href="${localePath(locale, `certifications/${id}`)}"`));
  }
  for (const page of ['certifications', 'study/fundamentals', 'study/questions'])
    assert(html.includes(`href="${localePath(locale, page)}"`), `${locale}: action ${page}`);
  assert(html.includes('href="https://aws.amazon.com/certification/"'), `${locale}: official link`);
  for (const page of ['', 'certifications']) {
    const entrance = await readFile(routeFile(locale, page), 'utf8');
    assert(
      entrance.includes(`href="${localePath(locale, overviewPage)}"`),
      `${locale}: static entrance on ${page || 'landing'}`,
    );
  }
}

for (const locale of locales) {
  const content = JSON.parse(await readFile(`public/translations/${locale}/site.json`, 'utf8')) as {
    certifications: Record<string, { name: string }>;
    guides: Record<string, { scope: string; audience: string }>;
  };
  for (const id of certificationIds) {
    const html = await readFile(routeFile(locale, `certifications/${id}`), 'utf8');
    assert(html.includes(escapeBodyText(content.certifications[id].name)), `${locale}/${id}: name`);
    assert(html.includes(escapeBodyText(content.guides[id].scope)), `${locale}/${id}: scope`);
    assert(html.includes(escapeBodyText(content.guides[id].audience)), `${locale}/${id}: audience`);
  }
  for (const page of ['study', 'study/questions', 'study/fundamentals', 'certifications']) {
    const html = await readFile(routeFile(locale, page), 'utf8');
    assert(html.includes('<h1>'), `${locale}/${page}: heading`);
    assert(/<a\s[^>]*\bhref="/.test(html), `${locale}/${page}: links`);
  }
}

const sitemap = await readFile('dist/sitemap.xml', 'utf8');
for (const locale of locales)
  assert.equal(
    sitemap.split(`${origin}${localePath(locale, overviewPage)}`).length - 1,
    1,
    `${locale}: sitemap`,
  );

console.log(`Validated ${locales.length} static certification overview pages and entrances.`);
