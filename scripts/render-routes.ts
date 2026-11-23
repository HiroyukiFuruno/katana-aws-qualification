import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localePath, locales } from '../src/locales.ts';
import { type Message, messages } from '../src/messages.ts';
import { accountPages, privateLessonPages, publishedLocalesFor, publishedPages } from '../src/routes.ts';
import { localizedBuildContent } from './localized-build-content.ts';

const origin = 'https://kaq.katana-projects.org';
const template = await readFile('dist/index.html', 'utf8');
const indexTitles = {
  '': 'landingSearchTitle',
  study: 'study',
  'study/fundamentals': 'learnFundamentals',
  'study/questions': 'learnFromQuestions',
  assessment: 'skillsAssessment',
  certifications: 'certGuides',
  'certifications/overview': 'certOverviewSearchTitle',
  glossary: 'glossary',
  privacy: 'privacy',
} satisfies Record<string, Message>;
const published: string[] = [];

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function descriptionFor(entry: string, dictionary: Record<Message, string>) {
  if (entry === 'glossary') return dictionary.glossaryIntro;
  if (entry === 'certifications/overview') return dictionary.certOverviewDescription;
  return dictionary.landingDescription;
}

for (const locale of locales) {
  const dictionary = messages[locale];
  const content = await localizedBuildContent(locale);
  for (const entry of publishedPages) {
    const supported = publishedLocalesFor(entry);
    if (!supported.includes(locale)) continue;
    const path = localePath(locale, entry);
    const baseTitle = Object.hasOwn(indexTitles, entry)
      ? dictionary[indexTitles[entry as keyof typeof indexTitles]]
      : content.titleFor(entry);
    if (!baseTitle) throw new Error(`Missing title for ${entry}`);
    const alternateLinks = [...supported, 'x-default']
      .map(
        (alternate) =>
          `<link rel="alternate" hreflang="${alternate}" href="${origin}${localePath(alternate === 'x-default' ? 'en' : alternate, entry)}">`,
      )
      .join('\n');
    const description = escapeHtml(descriptionFor(entry, dictionary));
    const html = template
      .replace('lang="en"', `lang="${locale}"`)
      .replace(
        /<title>[^<]+<\/title>/,
        `<title>${escapeHtml(baseTitle)} | ${escapeHtml(dictionary.siteName)}</title>`,
      )
      .replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${description}">`,
      )
      .replace(
        /<link rel="canonical" href="[^"]*">/,
        `<link rel="canonical" href="${origin}${path}">\n${alternateLinks}`,
      );
    const directory = join('dist', path);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html);
    published.push(origin + path);
  }
}

for (const locale of locales) {
  const dictionary = messages[locale];
  for (const entry of accountPages) {
    const path = localePath(locale, entry);
    const html = template
      .replace('lang="en"', `lang="${locale}"`)
      .replace(
        /<title>[^<]+<\/title>/,
        `<title>${escapeHtml(dictionary[entry === 'dashboard' ? 'accountDashboard' : entry === 'login' ? 'accountSignIn' : 'accountLoading'])} | ${escapeHtml(dictionary.siteName)}</title>`,
      )
      .replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${escapeHtml(dictionary.accountSsoOnly)}">`,
      )
      .replace(/<link rel="canonical" href="[^"]*">/, '')
      .replace(
        '</head>',
        '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"></head>',
      );
    const directory = join('dist', path);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html);
  }
}

for (const locale of locales) {
  const content = await localizedBuildContent(locale);
  for (const entry of privateLessonPages) {
    const path = localePath(locale, entry);
    const directory = join('dist', path);
    await mkdir(directory, { recursive: true });
    const html = template
      .replace('lang="en"', `lang="${locale}"`)
      .replace(
        /<title>[^<]+<\/title>/,
        `<title>${escapeHtml(content.titleFor(entry) ?? messages[locale].learnFundamentals)} | ${escapeHtml(messages[locale].siteName)}</title>`,
      )
      .replace(/<link rel="canonical" href="[^"]*">/, '')
      .replace(
        '</head>',
        '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"></head>',
      );
    await writeFile(join(directory, 'index.html'), html);
  }
}

await writeFile(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${published.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`,
);
