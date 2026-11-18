import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { certifications } from '../src/certifications.ts';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';

const origin = 'https://kaq.katana-projects.org';
const template = await readFile('dist/index.html', 'utf8');
const entries = [
  '',
  'study',
  'assessment',
  'certifications',
  ...certifications.map((cert) => `certifications/${cert.id}`),
  ...certifications.filter((cert) => cert.course).map((cert) => `study/${cert.id}`),
];
const published: string[] = [];

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

for (const locale of locales) {
  for (const entry of entries) {
    const path = localePath(locale, entry);
    const certification = certifications.find((cert) => cert.id === entry.split('/')[1]);
    const baseTitle =
      entry === ''
        ? messages.landingTitle[locale]
        : entry === 'study'
          ? messages.chooseCourse[locale]
          : entry === 'assessment'
            ? messages.skillsAssessment[locale]
            : entry === 'certifications'
              ? messages.certGuides[locale]
              : certification && `${certification.name} (${certification.id.toUpperCase()})`;
    if (!baseTitle) throw new Error(`Missing title for ${entry}`);
    const alternateLinks = locales
      .map(
        (alternate) =>
          `<link rel="alternate" hreflang="${alternate}" href="${origin}${localePath(alternate, entry)}">`,
      )
      .join('\n');
    const description = escapeHtml(messages.landingIntro[locale]);
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
