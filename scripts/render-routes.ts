import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { certifications, studyCourses } from '../src/certifications.ts';
import { localePath, locales } from '../src/locales.ts';
import { type Message, messages } from '../src/messages.ts';
import { accountPages, publishedLocalesFor, publishedPages } from '../src/routes.ts';

const origin = 'https://kaq.katana-projects.org';
const template = await readFile('dist/index.html', 'utf8');
const indexTitles = {
  '': 'landingSearchTitle',
  study: 'study',
  'study/fundamentals': 'learnFundamentals',
  'study/questions': 'learnFromQuestions',
  assessment: 'skillsAssessment',
  certifications: 'certGuides',
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

for (const locale of locales) {
  const dictionary = messages[locale];
  for (const entry of publishedPages) {
    const supported = publishedLocalesFor(entry);
    if (!supported.includes(locale)) continue;
    const path = localePath(locale, entry);
    const entries = entry.startsWith('study/') ? studyCourses : certifications;
    const certification = entries.find((cert) => cert.id === entry.split('/')[1]);
    const baseTitle = Object.hasOwn(indexTitles, entry)
      ? dictionary[indexTitles[entry as keyof typeof indexTitles]]
      : certification && `${certification.name} (${certification.id.toUpperCase()})`;
    if (!baseTitle) throw new Error(`Missing title for ${entry}`);
    const alternateLinks = [...supported, 'x-default']
      .map(
        (alternate) =>
          `<link rel="alternate" hreflang="${alternate}" href="${origin}${localePath(alternate === 'x-default' ? 'en' : alternate, entry)}">`,
      )
      .join('\n');
    const description = escapeHtml(
      entry === 'glossary' ? dictionary.glossaryIntro : dictionary.landingDescription,
    );
    const html = template
      .replace('lang="en"', `lang="${locale}"`)
      .replace(
        /<title>[^<]+<\/title>/,
        `<title>${escapeHtml(baseTitle)} | KatanA AWS Qualification</title>`,
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
  for (const entry of accountPages) {
    const path = localePath(locale, entry);
    const html = template
      .replace('lang="en"', `lang="${locale}"`)
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

await writeFile(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${published.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`,
);
