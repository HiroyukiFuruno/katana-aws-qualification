import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { certifications } from '../src/certifications.ts';
import { localePath, locales } from '../src/locales.ts';
import { messages, type Message } from '../src/messages.ts';
import { publishedPages } from '../src/routes.ts';

const origin = 'https://kaq.katana-projects.org';
const template = await readFile('dist/index.html', 'utf8');
const indexTitles = {
  '': 'landingTitle',
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
    const path = localePath(locale, entry);
    const certification = certifications.find((cert) => cert.id === entry.split('/')[1]);
    const baseTitle = Object.hasOwn(indexTitles, entry)
      ? dictionary[indexTitles[entry as keyof typeof indexTitles]]
      : certification && `${certification.name} (${certification.id.toUpperCase()})`;
    if (!baseTitle) throw new Error(`Missing title for ${entry}`);
    const alternateLinks = [...locales, 'x-default']
      .map(
        (alternate) =>
          `<link rel="alternate" hreflang="${alternate}" href="${origin}${localePath(alternate === 'x-default' ? 'en' : alternate, entry)}">`,
      )
      .join('\n');
    const description = escapeHtml(
      entry === 'glossary' ? dictionary.glossaryIntro : dictionary.landingIntro,
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

await writeFile(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${published.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`,
);
